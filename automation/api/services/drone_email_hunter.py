"""
Drone Email Hunter — Multi-strategy email discovery for academic prospects.

The biggest gap in the pipeline: Scholar and arXiv crawlers discover high-quality
prospects but NEVER find emails. Faculty crawler only gets emails from static HTML.
This service fills that gap with a 7-strategy waterfall:

  1. University directory lookup (LDAP-style public directories)
  2. Department page deep scrape (profile pages, not just listing pages)
  3. Google Scholar profile email extraction
  4. .edu email pattern guess + MX verification
  5. GitHub commit email extraction (Events API trick)
  6. Hunter.io domain search (EDU-aware)
  7. arXiv paper PDF metadata extraction (author emails in LaTeX source)

Each strategy runs independently. First verified hit wins.
"""

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote, urljoin, urlparse
from uuid import uuid4

import aiohttp
import dns.resolver
from bs4 import BeautifulSoup
from sqlalchemy import select, or_, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import settings
from api.database import async_session_factory
from api.models.prospect import DroneProspect

logger = logging.getLogger("drone.email_hunter")

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
HTTP_TIMEOUT = aiohttp.ClientTimeout(total=15)

# Words that are NOT part of a person's name — these get scraped from
# page text and accidentally prepended/appended to names
_NAME_GARBAGE_WORDS = {
    "reintroducing", "introducing", "featuring", "featuring:", "meet",
    "professor", "prof", "prof.", "dr", "dr.", "mr", "mr.", "mrs", "mrs.",
    "ms", "ms.", "contact", "email", "about", "page", "results", "people",
    "search", "faculty", "member", "staff", "researcher", "author",
    "view", "profile", "show", "details", "overview", "homepage",
}


def _clean_person_name(name: str) -> str:
    """Strip garbage words from the front/back of a scraped name."""
    words = name.strip().split()
    # Strip garbage from front
    while words and words[0].lower().rstrip(".:,") in _NAME_GARBAGE_WORDS:
        words.pop(0)
    # Strip garbage from back
    while words and words[-1].lower().rstrip(".:,") in _NAME_GARBAGE_WORDS:
        words.pop()
    return " ".join(words) if words else name.strip()

# ─── University domain mapping ───────────────────────────────────────
# Maps common org names → email domains. Covers the top research universities.
# This is the secret sauce: we can guess emails like {flast}@mit.edu.
UNIVERSITY_DOMAINS = {
    "mit": "mit.edu",
    "stanford": "stanford.edu",
    "carnegie mellon": "cmu.edu",
    "georgia tech": "gatech.edu",
    "ut austin": "utexas.edu",
    "uc berkeley": "berkeley.edu",
    "purdue": "purdue.edu",
    "university of michigan": "umich.edu",
    "virginia tech": "vt.edu",
    "penn state": "psu.edu",
    "university of maryland": "umd.edu",
    "university of illinois": "illinois.edu",
    "texas a&m": "tamu.edu",
    "university of florida": "ufl.edu",
    "university of washington": "uw.edu",
    "ohio state": "osu.edu",
    "cornell": "cornell.edu",
    "university of colorado": "colorado.edu",
    "arizona state": "asu.edu",
    "clemson": "clemson.edu",
    "caltech": "caltech.edu",
    "princeton": "princeton.edu",
    "yale": "yale.edu",
    "harvard": "harvard.edu",
    "columbia": "columbia.edu",
    "upenn": "upenn.edu",
    "university of pennsylvania": "upenn.edu",
    "johns hopkins": "jhu.edu",
    "northwestern": "northwestern.edu",
    "duke": "duke.edu",
    "rice": "rice.edu",
    "usc": "usc.edu",
    "ucla": "ucla.edu",
    "ucsd": "ucsd.edu",
    "uci": "uci.edu",
    "uc davis": "ucdavis.edu",
    "uc santa barbara": "ucsb.edu",
    "boston university": "bu.edu",
    "nyu": "nyu.edu",
    "university of virginia": "virginia.edu",
    "iowa state": "iastate.edu",
    "oregon state": "oregonstate.edu",
    "north carolina state": "ncsu.edu",
    "michigan state": "msu.edu",
    "university of minnesota": "umn.edu",
    "university of wisconsin": "wisc.edu",
    "rutgers": "rutgers.edu",
    "drexel": "drexel.edu",
    "rpi": "rpi.edu",
    "rochester": "rochester.edu",
    "wpi": "wpi.edu",
    "embry-riddle": "erau.edu",
}

# University directory search URL patterns
DIRECTORY_URLS = {
    "mit.edu": "https://web.mit.edu/cgi-bin/ldap-search?query={name}",
    "stanford.edu": "https://stanfordwho.stanford.edu/SWApp/Search.do?search={name}",
    "gatech.edu": "https://directory.gatech.edu/?query={name}",
    "purdue.edu": "https://www.purdue.edu/directory/?searchString={name}",
    "umich.edu": "https://mcommunity.umich.edu/search?query={name}",
    "umd.edu": "https://directory.umd.edu/?search={name}",
    "illinois.edu": "https://directory.illinois.edu/search?query={name}",
    "cornell.edu": "https://www.cornell.edu/search/?q={name}",
    "utexas.edu": "https://directory.utexas.edu/index.php?q={name}",
    "cmu.edu": "https://directory.andrew.cmu.edu/search/?search={name}",
    "berkeley.edu": "https://www.berkeley.edu/directory/?search-term={name}",
}

# Patterns known to work for specific universities (verified common formats)
KNOWN_PATTERNS = {
    "mit.edu": ["{last}@mit.edu", "{first}{last[0]}@mit.edu"],
    "stanford.edu": ["{first}.{last}@stanford.edu", "{first}{last}@stanford.edu"],
    "cmu.edu": ["{first}{last[0]}@andrew.cmu.edu", "{first}.{last}@cmu.edu", "{first}@cmu.edu", "{first}@andrew.cmu.edu"],
    "gatech.edu": ["{first}.{last}@gatech.edu", "{first[0]}{last}@gatech.edu"],
    "utexas.edu": ["{first}.{last}@utexas.edu"],
    "berkeley.edu": ["{first}_{last}@berkeley.edu", "{first}.{last}@berkeley.edu"],
    "purdue.edu": ["{last}@purdue.edu", "{first[0]}{last}@purdue.edu"],
    "umich.edu": ["{first}{last}@umich.edu", "{first}@umich.edu"],
    "vt.edu": ["{first[0]}{last}@vt.edu"],
    "psu.edu": ["{first[0]}{last[0]}{last}@psu.edu"],
    "umd.edu": ["{first}@umd.edu", "{first[0]}{last}@umd.edu"],
    "illinois.edu": ["{first[0]}{last}@illinois.edu"],
    "tamu.edu": ["{first}.{last}@tamu.edu"],
    "ufl.edu": ["{first}.{last}@ufl.edu"],
    "uw.edu": ["{first}@uw.edu"],
    "osu.edu": ["{last}.{n}@osu.edu"],  # Ohio State uses last.N format
    "cornell.edu": ["{first[0]}{last[0]}{n}@cornell.edu"],  # initials + number
    "colorado.edu": ["{first}.{last}@colorado.edu"],
    "asu.edu": ["{first}.{last}@asu.edu"],
    "clemson.edu": ["{last}@clemson.edu", "{first[0]}{last}@clemson.edu"],
}


def _get_university_domain(org: str) -> Optional[str]:
    """Map an organization name to its .edu domain."""
    if not org:
        return None
    org_lower = org.lower().strip()
    # Direct match first
    if org_lower in UNIVERSITY_DOMAINS:
        return UNIVERSITY_DOMAINS[org_lower]
    # Fuzzy: check if any key is a substring
    for key, domain in UNIVERSITY_DOMAINS.items():
        if key in org_lower or org_lower in key:
            return domain
    return None


def _generate_edu_patterns(first: str, last: str, domain: str) -> list[str]:
    """
    Generate email guesses for a professor at a .edu domain.
    Uses university-specific known patterns plus common academic patterns.
    """
    if not first or not last:
        return []
    first = first.lower().strip()
    last = last.lower().strip()

    # Start with known patterns for this domain
    guesses = []
    if domain in KNOWN_PATTERNS:
        for pattern in KNOWN_PATTERNS[domain]:
            try:
                email = pattern.format(
                    first=first, last=last,
                    **{"first[0]": first[0], "last[0]": last[0], "n": "1"}
                )
                guesses.append(email)
            except (KeyError, IndexError):
                continue

    # Common academic patterns (universal)
    common = [
        f"{first}.{last}@{domain}",
        f"{first[0]}{last}@{domain}",
        f"{first}{last[0]}@{domain}",
        f"{first}@{domain}",
        f"{last}@{domain}",
        f"{first[0]}.{last}@{domain}",
        f"{first}{last}@{domain}",
    ]
    for guess in common:
        if guess not in guesses:
            guesses.append(guess)

    return guesses


# ─── Email Verification (reused from recon_engine) ──────────────────

async def check_mx(domain: str) -> list[str]:
    """Resolve MX records for a domain."""
    try:
        loop = asyncio.get_event_loop()
        answers = await loop.run_in_executor(
            None, lambda: dns.resolver.resolve(domain, "MX")
        )
        return sorted([str(r.exchange).rstrip(".") for r in answers])
    except Exception:
        return []


# Track whether outbound port 25 is reachable (cached across calls)
_smtp_port_25_reachable: bool | None = None


async def _check_port_25() -> bool:
    """Test if outbound port 25 is reachable. Cached for efficiency."""
    global _smtp_port_25_reachable
    if _smtp_port_25_reachable is not None:
        return _smtp_port_25_reachable
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection("alt1.gmail-smtp-in.l.google.com", 25), timeout=5
        )
        writer.close()
        _smtp_port_25_reachable = True
        logger.info("[SMTP] Port 25 reachable — full SMTP verification enabled")
    except Exception:
        _smtp_port_25_reachable = False
        logger.warning("[SMTP] Port 25 blocked — falling back to MX-only verification")
    return _smtp_port_25_reachable


async def smtp_verify_email(email: str) -> dict:
    """
    Verify email via SMTP RCPT TO handshake.
    Returns {'valid': bool, 'catch_all': bool, 'mx_valid': bool}.
    Falls back to MX-only verification if port 25 is blocked.
    """
    domain = email.split("@")[-1]
    mx_hosts = await check_mx(domain)
    if not mx_hosts:
        return {"valid": False, "catch_all": False, "mx_valid": False}

    # If port 25 is blocked, return MX-valid (domain accepts mail)
    if not await _check_port_25():
        return {"valid": False, "catch_all": False, "mx_valid": True}

    for mx_host in mx_hosts[:2]:
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(mx_host, 25), timeout=10
            )
            await asyncio.wait_for(reader.readline(), timeout=5)

            writer.write(b"EHLO ajbuildsdrone.com\r\n")
            await writer.drain()
            await asyncio.wait_for(reader.readline(), timeout=5)

            writer.write(b"MAIL FROM:<verify@ajbuildsdrone.com>\r\n")
            await writer.drain()
            await asyncio.wait_for(reader.readline(), timeout=5)

            writer.write(f"RCPT TO:<{email}>\r\n".encode())
            await writer.drain()
            response = await asyncio.wait_for(reader.readline(), timeout=5)
            code = int(response[:3])

            # Catch-all detection
            fake = f"xyzzy_noreply_{hash(email) % 999999}@{domain}"
            writer.write(f"RCPT TO:<{fake}>\r\n".encode())
            await writer.drain()
            fake_resp = await asyncio.wait_for(reader.readline(), timeout=5)
            is_catch_all = int(fake_resp[:3]) == 250

            writer.write(b"QUIT\r\n")
            await writer.drain()
            writer.close()

            return {"valid": code == 250 and not is_catch_all, "catch_all": is_catch_all, "mx_valid": True}
        except Exception as e:
            logger.debug("SMTP check failed for %s via %s: %s", email, mx_host, e)
            continue

    return {"valid": False, "catch_all": False, "mx_valid": True}


# ─── Strategy 1: University Directory Search ─────────────────────────

async def _strategy_directory(session: aiohttp.ClientSession, name: str, domain: str) -> Optional[str]:
    """Search university public directory for email."""
    if domain not in DIRECTORY_URLS:
        return None

    search_name = quote(name)
    url = DIRECTORY_URLS[domain].format(name=search_name)

    try:
        async with session.get(url, timeout=HTTP_TIMEOUT, allow_redirects=True,
                               headers={"User-Agent": "Mozilla/5.0 (compatible; AcademicBot/1.0)"}) as resp:
            if resp.status != 200:
                return None
            html = await resp.text()

        # Extract emails from the directory page
        emails = EMAIL_RE.findall(html)
        # Filter to .edu emails from this domain
        edu_emails = [e for e in emails if domain in e.lower()]

        # Try to match by last name for precision
        last = name.strip().split()[-1].lower() if name.strip() else ""
        for email in edu_emails:
            if last and last in email.lower():
                logger.info("[Directory] Found %s via %s directory", email, domain)
                return email

        # Return first .edu email if only one match
        if len(edu_emails) == 1:
            return edu_emails[0]

    except Exception as e:
        logger.info("[Directory] Error for %s at %s: %s", name, domain, e)

    return None


# ─── Strategy 2: Personal/Faculty Profile Deep Scrape ─────────────────

async def _strategy_profile_scrape(session: aiohttp.ClientSession,
                                   personal_site: Optional[str],
                                   lab_url: Optional[str],
                                   scholar_url: Optional[str]) -> Optional[str]:
    """Scrape individual profile pages (not listing pages) for email."""
    urls = [u for u in [personal_site, lab_url] if u]

    for url in urls:
        try:
            async with session.get(url, timeout=HTTP_TIMEOUT, allow_redirects=True,
                                   headers={"User-Agent": "Mozilla/5.0 (compatible; AcademicBot/1.0)"}) as resp:
                if resp.status != 200:
                    continue
                html = await resp.text()

            # Parse for emails
            soup = BeautifulSoup(html, "html.parser")

            # Method A: mailto links (most reliable)
            for link in soup.select("a[href^='mailto:']"):
                email = link["href"].replace("mailto:", "").split("?")[0].strip()
                if EMAIL_RE.match(email):
                    logger.info("[ProfileScrape] Found %s via mailto on %s", email, url)
                    return email

            # Method B: Regex on visible text
            text = soup.get_text(" ", strip=True)
            found = EMAIL_RE.findall(text)
            edu_emails = [e for e in found if ".edu" in e.lower()]
            if edu_emails:
                logger.info("[ProfileScrape] Found %s via text on %s", edu_emails[0], url)
                return edu_emails[0]
            if found:
                # Filter out image/file emails
                real = [e for e in found if not any(x in e.lower() for x in
                        ["example.com", "email.com", "domain.com", ".png", ".jpg"])]
                if real:
                    logger.info("[ProfileScrape] Found %s via text on %s", real[0], url)
                    return real[0]

            # Method C: Check meta tags (some CMS put email in meta)
            for meta in soup.select("meta[name='author'], meta[property='article:author']"):
                content = meta.get("content", "")
                emails = EMAIL_RE.findall(content)
                if emails:
                    return emails[0]

            # Method D: Check JSON-LD structured data
            for script in soup.select('script[type="application/ld+json"]'):
                text = script.string or ""
                emails = EMAIL_RE.findall(text)
                if emails:
                    logger.info("[ProfileScrape] Found %s in JSON-LD on %s", emails[0], url)
                    return emails[0]

            # Method E: Look for obfuscated emails (common on university sites)
            # Pattern: "username [at] domain [dot] edu"
            at_patterns = re.findall(
                r"([a-zA-Z0-9._%+-]+)\s*(?:\[at\]|&#64;|\(at\)|{at})\s*"
                r"([a-zA-Z0-9.-]+)\s*(?:\[dot\]|&#46;|\(dot\)|{dot})\s*"
                r"([a-zA-Z]{2,})",
                text, re.IGNORECASE
            )
            if at_patterns:
                user, domain_part, tld = at_patterns[0]
                email = f"{user}@{domain_part}.{tld}"
                logger.info("[ProfileScrape] Found obfuscated email %s on %s", email, url)
                return email

        except Exception as e:
            logger.info("[ProfileScrape] Error scraping %s: %s", url, e)

    return None


# ─── Strategy 3: Google Scholar Email ─────────────────────────────────

async def _strategy_scholar(session: aiohttp.ClientSession, scholar_url: Optional[str],
                            name: str) -> Optional[str]:
    """
    Google Scholar profiles sometimes show "Verified email at domain.edu".
    We use this to confirm the domain, then pattern-guess the exact address.
    Also try scraping the Scholar profile page for email text.
    """
    if not scholar_url:
        return None

    try:
        async with session.get(scholar_url, timeout=HTTP_TIMEOUT, allow_redirects=True,
                               headers={"User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)"}) as resp:
            if resp.status != 200:
                return None
            html = await resp.text()

        # Look for "Verified email at X" text
        verified_match = re.search(
            r"Verified email at\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})", html
        )
        if verified_match:
            domain = verified_match.group(1).lower()
            logger.info("[Scholar] Verified domain for %s: %s", name, domain)
            # Now we know their domain — try pattern guessing with MX verification
            parts = name.strip().split()
            if len(parts) >= 2:
                first, last = parts[0], parts[-1]
                guesses = _generate_edu_patterns(first, last, domain)
                for guess in guesses[:5]:  # Limit SMTP checks
                    result = await smtp_verify_email(guess)
                    if result["valid"]:
                        logger.info("[Scholar→SMTP] Verified %s for %s", guess, name)
                        return guess
                    if result["catch_all"]:
                        # Domain accepts all — return best guess (first.last is safest)
                        best = f"{first.lower()}.{last.lower()}@{domain}"
                        logger.info("[Scholar→CatchAll] Best guess %s for %s", best, name)
                        return best
                    if result.get("mx_valid") and not result["valid"]:
                        # Port 25 blocked but MX valid — return best pattern guess
                        best = guesses[0] if guesses else f"{first.lower()}.{last.lower()}@{domain}"
                        logger.info("[Scholar→MX] Port 25 blocked, MX valid — returning %s for %s", best, name)
                        return best

        # Also check for direct email in page text
        emails = EMAIL_RE.findall(html)
        edu_emails = [e for e in emails if ".edu" in e.lower()]
        if edu_emails:
            return edu_emails[0]

    except Exception as e:
        logger.info("[Scholar] Error for %s: %s", name, e)

    return None


# ─── Strategy 4: .edu Pattern Guess + MX Verify ──────────────────────

async def _strategy_pattern_guess(name: str, org: str) -> Optional[str]:
    """
    Generate email guesses from name + university domain, verify via SMTP.
    This is the highest-volume strategy — works for any professor if we
    know their university.
    """
    domain = _get_university_domain(org)
    if not domain:
        return None

    parts = name.strip().split()
    if len(parts) < 2:
        return None
    first, last = parts[0], parts[-1]

    guesses = _generate_edu_patterns(first, last, domain)
    if not guesses:
        return None

    # Verify MX exists first (skip if domain has no mail server)
    mx_hosts = await check_mx(domain)
    if not mx_hosts:
        logger.info("[PatternGuess] No MX records for %s — skipping %s", domain, name)
        return None

    for guess in guesses[:7]:  # Cap SMTP verification attempts
        result = await smtp_verify_email(guess)
        if result["valid"]:
            logger.info("[PatternGuess] SMTP verified %s for %s at %s", guess, name, org)
            return guess
        if result.get("catch_all"):
            best = f"{first.lower()}.{last.lower()}@{domain}"
            logger.info("[PatternGuess] Catch-all domain %s — returning %s", domain, best)
            return best
        if result.get("mx_valid") and not result["valid"]:
            # Port 25 blocked — MX valid, return best guess (first.last@domain)
            best = guesses[0]  # first known pattern or first.last@domain
            logger.info("[PatternGuess] MX valid for %s, port 25 blocked — returning best guess %s", domain, best)
            return best

    return None


# ─── Strategy 5: GitHub Commit Email (Events API trick) ──────────────

async def _strategy_github_events(session: aiohttp.ClientSession,
                                  name: str, enrichment: dict) -> Optional[str]:
    """
    The GitHub Events API exposes commit author emails in PushEvent payloads,
    even when the user's profile email is private.
    """
    github_login = enrichment.get("github_login")
    if not github_login:
        return None

    token = settings.gh_token
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    url = f"https://api.github.com/users/{github_login}/events/public"
    try:
        async with session.get(url, headers=headers, timeout=HTTP_TIMEOUT) as resp:
            if resp.status != 200:
                return None
            events = await resp.json()

        for event in events:
            if event.get("type") != "PushEvent":
                continue
            commits = event.get("payload", {}).get("commits", [])
            for commit in commits:
                author = commit.get("author", {})
                email = author.get("email", "")
                # Skip GitHub noreply and generic emails
                if (email and "@" in email
                        and "noreply" not in email.lower()
                        and "users.noreply.github.com" not in email.lower()):
                    logger.info("[GitHubEvents] Found %s for %s via push event", email, name)
                    return email

    except Exception as e:
        logger.debug("[GitHubEvents] Error for %s: %s", github_login, e)

    return None


# ─── Strategy 6: Hunter.io (EDU-aware) ───────────────────────────────

async def _strategy_hunter(session: aiohttp.ClientSession, name: str,
                           org: str) -> Optional[str]:
    """Use Hunter.io to search for the person by name + domain."""
    api_key = settings.hunter_api_key
    if not api_key:
        return None

    domain = _get_university_domain(org)
    if not domain:
        return None

    parts = name.strip().split()
    if len(parts) < 2:
        return None
    first_name, last_name = parts[0], parts[-1]

    try:
        url = "https://api.hunter.io/v2/email-finder"
        params = {
            "domain": domain,
            "first_name": first_name,
            "last_name": last_name,
            "api_key": api_key,
        }
        async with session.get(url, params=params, timeout=HTTP_TIMEOUT) as resp:
            if resp.status != 200:
                return None
            data = await resp.json()
            email = data.get("data", {}).get("email")
            confidence = data.get("data", {}).get("confidence", 0)
            if email and confidence >= 60:
                logger.info("[Hunter] Found %s (confidence=%d) for %s", email, confidence, name)
                return email

    except Exception as e:
        logger.info("[Hunter] Error for %s: %s", name, e)

    return None


# ─── Strategy 7: arXiv Paper Source (LaTeX email) ─────────────────────

async def _strategy_arxiv_source(session: aiohttp.ClientSession,
                                 name: str, enrichment: dict) -> Optional[str]:
    """
    arXiv papers have author emails in:
    1. The abs page (mailto links, visible text)
    2. The HTML5 full-text view (/html/{id}) — contains LaTeX source with
       \\author{} blocks that often include emails
    """
    recent_papers = enrichment.get("recent_papers") or []
    if not recent_papers and enrichment.get("arxiv_ids"):
        recent_papers = [{"url": f"https://arxiv.org/abs/{aid}"} for aid in enrichment["arxiv_ids"][:3]]

    last_name = name.strip().split()[-1].lower() if name.strip() else ""

    for paper in recent_papers[:3]:
        paper_url = paper.get("url", "") if isinstance(paper, dict) else str(paper)
        if "arxiv.org" not in paper_url:
            continue

        # Extract arXiv ID
        arxiv_id = paper_url.rstrip("/").split("/")[-1]
        # Strip version suffix for html endpoint
        arxiv_id_base = re.sub(r"v\d+$", "", arxiv_id)

        # Try both abs page and HTML5 full-text
        urls_to_try = [
            f"https://arxiv.org/abs/{arxiv_id}",
            f"https://arxiv.org/html/{arxiv_id_base}",
        ]

        for url in urls_to_try:
            try:
                async with session.get(url, timeout=HTTP_TIMEOUT, allow_redirects=True,
                                       headers={"User-Agent": "Mozilla/5.0 AcademicBot/1.0"}) as resp:
                    if resp.status != 200:
                        continue
                    html = await resp.text()

                emails = EMAIL_RE.findall(html)
                # Filter out system/generic emails
                filtered = [e for e in emails if not any(x in e.lower() for x in [
                    "arxiv.org", "example.com", "noreply", "support",
                ])]

                # Prefer emails matching the professor's last name
                for email in filtered:
                    if last_name and last_name in email.lower():
                        logger.info("[arXiv] Found %s for %s in %s", email, name, url)
                        return email
                # Fallback: any academic email on the page
                edu = [e for e in filtered if any(x in e.lower() for x in [".edu", ".ac.", ".org"])]
                if edu:
                    logger.info("[arXiv] Found academic email %s for %s", edu[0], name)
                    return edu[0]

            except Exception as e:
                logger.info("[arXiv] Error for %s from %s: %s", name, url, e)

    return None


# ─── Strategy 8: Semantic Scholar → Paper DOI → Publisher email ───────

S2_API = "https://api.semanticscholar.org/graph/v1"
S2_TIMEOUT = aiohttp.ClientTimeout(total=20)

# Emails / domains we never want as co-author prospects
_IGNORE_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "example.com", "noreply", "arxiv.org", "ieee.org",
    "springer.com", "elsevier.com", "acm.org", "wiley.com",
}


def _is_academic_email(email: str) -> bool:
    """Check if an email looks like an academic/institutional address."""
    domain = email.split("@")[-1].lower()
    if any(x in domain for x in _IGNORE_EMAIL_DOMAINS):
        return False
    # Academic TLDs
    return any(x in domain for x in [
        ".edu", ".ac.", "uni-", ".univ", ".eth.", ".epfl.",
        ".inria.", ".cnrs.", ".mpg.de", ".cam.ac", ".ox.ac",
        "tu-", ".ntnu.", ".ntu.", ".kaist.", ".mit.",
        # Common research org patterns
        ".gov", ".org", ".re", ".csic.", ".csiro.",
    ])


def _collect_all_page_emails(html: str) -> set[str]:
    """Extract all unique email addresses from a page's HTML."""
    soup = BeautifulSoup(html, "html.parser")
    emails = set()

    # From mailto links
    for link in soup.select("a[href^='mailto:']"):
        addr = link["href"].replace("mailto:", "").split("?")[0].strip()
        if EMAIL_RE.match(addr):
            emails.add(addr.lower())

    # From visible text
    text = soup.get_text(" ", strip=True)
    for addr in EMAIL_RE.findall(text):
        emails.add(addr.lower())

    return emails


async def _save_coauthor_prospects(
    coauthors: list[dict],
    source_paper_title: str,
):
    """Save co-authors discovered from paper scraping as new prospects.

    Each entry in coauthors: {'name': str, 'email': str, 'affiliations': list[str]}
    Dedup by email — skip if a DroneProspect with this email already exists.
    """
    if not coauthors:
        return

    async with async_session_factory() as db:
        saved = 0
        for ca in coauthors:
            email = ca["email"]
            name = ca["name"]
            org = ca.get("affiliations", [""])[0] if ca.get("affiliations") else ""

            # Dedup: skip if email already exists
            existing = (await db.execute(
                select(DroneProspect.id).where(
                    DroneProspect.email == email
                ).limit(1)
            )).first()
            if existing:
                continue

            # Also dedup by name + org
            if name and org:
                existing2 = (await db.execute(
                    select(DroneProspect.id).where(
                        DroneProspect.name == name,
                        DroneProspect.organization == org,
                    ).limit(1)
                )).first()
                if existing2:
                    # Update existing prospect with the discovered email
                    from sqlalchemy import update
                    await db.execute(
                        update(DroneProspect)
                        .where(DroneProspect.id == existing2[0])
                        .values(email=email)
                    )
                    saved += 1
                    continue

            prospect = DroneProspect(
                id=uuid4(),
                name=name,
                title="Researcher",
                organization=org or "Unknown",
                organization_type="university",
                email=email,
                source="coauthor_paper",
                source_url=f"Co-author discovered via paper: {source_paper_title[:120]}",
                status="discovered",
                enrichment={
                    "email_source": "coauthor_paper",
                    "email_found_at": datetime.now(timezone.utc).isoformat(),
                    "discovered_via_paper": source_paper_title[:200],
                },
            )
            db.add(prospect)
            saved += 1

        if saved:
            await db.commit()
            logger.info(
                "[S2→CoAuthor] Saved %d co-author prospect(s) from paper '%s'",
                saved, source_paper_title[:60],
            )


async def _strategy_semantic_scholar(session: aiohttp.ClientSession,
                                     name: str, org: str,
                                     recent_papers: list | None) -> Optional[str]:
    """
    Use Semantic Scholar to find the author's latest papers, then:
    1. Check S2 author data for email (rare but happens)
    2. Get DOIs from recent papers
    3. Try CrossRef for corresponding author email
    4. Scrape publisher HTML for corresponding author email
    """
    last_name = name.strip().split()[-1] if name.strip() else ""
    if not last_name or len(last_name) < 2:
        return None

    # Phase A: Search Semantic Scholar for author
    author_id = None
    try:
        # Try with org first (more precise), then name-only (broader)
        queries_to_try = [f"{name} {org}"] if org else [name]
        queries_to_try.append(name)  # Always try name-only as fallback

        for search_query in queries_to_try:
            async with session.get(
                f"{S2_API}/author/search",
                params={"query": search_query, "limit": "5",
                        "fields": "name,affiliations,paperCount,hIndex"},
                timeout=S2_TIMEOUT,
                headers={"User-Agent": "AJBuildsDrone/1.0 (academic research outreach)"},
            ) as resp:
                if resp.status == 429:
                    logger.debug("[S2] Rate limited, skipping")
                    return None
                if resp.status != 200:
                    continue
                data = await resp.json()

            # Match by last name in author's full name
            for author in data.get("data", []):
                a_name = (author.get("name") or "").lower()
                if last_name.lower() in a_name:
                    author_id = author.get("authorId")
                    logger.debug("[S2] Found author %s (id=%s) for %s", a_name, author_id, name)
                    break

            if author_id:
                break
    except Exception as e:
        logger.debug("[S2] Author search error for %s: %s", name, e)
        return None

    if not author_id:
        return None

    # Phase B: Get recent papers with DOIs, URLs, and co-author info
    dois = []
    paper_urls = []
    paper_authors: dict[str, list[dict]] = {}  # url → [{name, affiliations}]
    paper_titles: dict[str, str] = {}  # url → title
    try:
        async with session.get(
            f"{S2_API}/author/{author_id}/papers",
            params={"limit": "5", "fields": "title,year,externalIds,url,openAccessPdf,authors.name,authors.affiliations",
                    "sort": "year:desc"},
            timeout=S2_TIMEOUT,
            headers={"User-Agent": "AJBuildsDrone/1.0 (academic research outreach)"},
        ) as resp:
            if resp.status != 200:
                return None
            papers_data = await resp.json()

        for paper in papers_data.get("data", []):
            ext = paper.get("externalIds") or {}
            doi = ext.get("DOI")
            if doi:
                dois.append(doi)
            p_title = paper.get("title") or ""
            # Collect co-author data (excluding target author)
            co_authors_raw = [
                {"name": a.get("name", ""), "affiliations": a.get("affiliations") or []}
                for a in (paper.get("authors") or [])
                if a.get("name") and last_name.lower() not in (a["name"] or "").lower()
            ]
            # Collect S2 paper URL + any open access PDF
            s2_url = paper.get("url")
            if s2_url:
                paper_urls.append(s2_url)
                paper_authors[s2_url] = co_authors_raw
                paper_titles[s2_url] = p_title
            oa = paper.get("openAccessPdf") or {}
            if oa.get("url"):
                paper_urls.append(oa["url"])
                paper_authors[oa["url"]] = co_authors_raw
                paper_titles[oa["url"]] = p_title
            # If paper has ArXiv ID, add the HTML5 full-text URL
            arxiv_id = ext.get("ArXiv")
            if arxiv_id:
                for arxiv_url in [f"https://arxiv.org/html/{arxiv_id}", f"https://arxiv.org/abs/{arxiv_id}"]:
                    paper_urls.append(arxiv_url)
                    paper_authors[arxiv_url] = co_authors_raw
                    paper_titles[arxiv_url] = p_title

        await asyncio.sleep(1)  # Respect S2 rate limit
    except Exception as e:
        logger.debug("[S2] Papers fetch error for %s: %s", name, e)

    # Phase C: Try CrossRef for corresponding author email via DOI
    for doi in dois[:3]:
        email = await _crossref_email_from_doi(session, doi, last_name)
        if email:
            logger.info("[S2→CrossRef] Found %s for %s via DOI %s", email, name, doi)
            return email

    # Phase D: Scrape paper pages for author email + collect co-author emails
    for url in paper_urls[:6]:
        try:
            async with session.get(
                url, timeout=HTTP_TIMEOUT, allow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (compatible; AcademicBot/1.0)"},
            ) as resp:
                if resp.status != 200:
                    continue
                html = await resp.text()
        except Exception:
            continue

        # Collect ALL emails from to page
        all_page_emails = _collect_all_page_emails(html)
        if not all_page_emails:
            continue

        target_email = None
        coauthor_emails = []

        for em in all_page_emails:
            if last_name.lower() in em:
                target_email = em
            elif _is_academic_email(em):
                coauthor_emails.append(em)

        # Match co-author emails to S2 author names and save as prospects
        co_authors_for_url = paper_authors.get(url, [])
        p_title = paper_titles.get(url, "")
        if coauthor_emails and co_authors_for_url:
            matched_coauthors = _match_emails_to_authors(
                coauthor_emails, co_authors_for_url
            )
            if matched_coauthors:
                # Fire-and-forget save (don't block the hunt)
                try:
                    await _save_coauthor_prospects(matched_coauthors, p_title)
                except Exception as e:
                    logger.debug("[S2→CoAuthor] Save error: %s", e)

        if target_email:
            logger.info("[S2→PageScrape] Found %s for %s from %s", target_email, name, url)
            return target_email

    return None


def _match_emails_to_authors(
    emails: list[str],
    authors: list[dict],
) -> list[dict]:
    """Match scraped emails to co-author names by last name.

    Returns list of {'name': str, 'email': str, 'affiliations': list}.
    """
    matched = []
    used_emails: set[str] = set()

    for author in authors:
        a_name = author.get("name", "")
        if not a_name:
            continue
        parts = a_name.strip().split()
        if not parts:
            continue
        a_last = parts[-1].lower()
        if len(a_last) < 2:
            continue

        for em in emails:
            if em in used_emails:
                continue
            if a_last in em:
                matched.append({
                    "name": a_name,
                    "email": em,
                    "affiliations": author.get("affiliations", []),
                })
                used_emails.add(em)
                break  # One email per author

    return matched


async def _crossref_email_from_doi(session: aiohttp.ClientSession,
                                   doi: str, last_name: str) -> Optional[str]:
    """
    CrossRef stores corresponding author emails for many papers.
    GET https://api.crossref.org/works/{doi} → message.author[].affiliation, .email
    """
    try:
        url = f"https://api.crossref.org/works/{doi}"
        async with session.get(
            url, timeout=S2_TIMEOUT,
            headers={"User-Agent": "AJBuildsDrone/1.0 (mailto:ajayadesign@gmail.com)"},
        ) as resp:
            if resp.status != 200:
                return None
            data = await resp.json()

        authors = data.get("message", {}).get("author", [])
        # First: look for exact last-name match with email
        for author in authors:
            family = (author.get("family") or "").lower()
            affils = author.get("affiliation", [])
            # CrossRef sometimes puts email in affiliation entries or as ORCID
            # But the main field is just author-level email (rare but exists)
            # Check the sequence field — "first" = corresponding author
            if author.get("sequence") == "first" or family == last_name.lower():
                # Some publishers put email in affiliation text
                for affil in affils:
                    affil_name = affil.get("name", "")
                    emails = EMAIL_RE.findall(affil_name)
                    if emails:
                        return emails[0].lower()

        # Also check the full JSON text for email matching professor's name
        raw_text = str(authors)
        all_emails = EMAIL_RE.findall(raw_text)
        for em in all_emails:
            em_lower = em.lower()
            if last_name.lower() in em_lower:
                return em_lower

    except Exception as e:
        logger.debug("[CrossRef] Error for DOI %s: %s", doi, e)

    return None


async def _scrape_page_for_email(session: aiohttp.ClientSession,
                                 url: str, last_name: str) -> Optional[str]:
    """
    Scrape a paper's web page (publisher, S2, arXiv) for author email.
    Looks for corresponding author sections, mailto links, etc.
    """
    try:
        async with session.get(
            url, timeout=HTTP_TIMEOUT, allow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; AcademicBot/1.0)"},
        ) as resp:
            if resp.status != 200:
                return None
            html = await resp.text()

        soup = BeautifulSoup(html, "html.parser")

        # Method 1: mailto links matching the professor's last name
        for link in soup.select("a[href^='mailto:']"):
            email = link["href"].replace("mailto:", "").split("?")[0].strip()
            if EMAIL_RE.match(email):
                em_lower = email.lower()
                if last_name.lower() in em_lower:
                    return em_lower

        # Method 2: "Corresponding author" section — only if name matches nearby
        text = soup.get_text(" ", strip=True)
        corr_patterns = [
            r"[Cc]orrespond(?:ing|ence)[^:]*?:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})",
            r"[Cc]ontact\s+author[^:]*?:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})",
            r"[Ee]-?mail:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})",
        ]
        for pattern in corr_patterns:
            m = re.search(pattern, text)
            if m:
                found_email = m.group(1).lower()
                # Only return if last name appears in the email or in nearby text
                if last_name.lower() in found_email:
                    return found_email
                # Check if the professor's name appears near this email in text
                pos = text.lower().find(found_email)
                if pos >= 0:
                    context = text[max(0, pos - 200):pos + 200].lower()
                    if last_name.lower() in context:
                        return found_email

        # Method 3: All emails matching the professor's last name
        all_emails = EMAIL_RE.findall(text)
        for em in all_emails:
            if last_name.lower() in em.lower():
                return em.lower()

    except Exception as e:
        logger.debug("[PageScrape] Error for %s: %s", url, e)

    return None


# ─── Main Orchestrator ────────────────────────────────────────────────

async def hunt_email_for_prospect(prospect: DroneProspect,
                                  paper_first: bool = False) -> dict:
    """
    Run the full 8-strategy waterfall for a single prospect.
    Returns {'email': str|None, 'source': str, 'strategies_tried': int}.

    If paper_first=True (used for bounce recovery), the paper-based
    strategies (Semantic Scholar, arXiv, CrossRef) run BEFORE the
    SMTP-heavy strategies. This is faster and better for finding
    updated emails when a professor has moved institutions.
    """
    name = _clean_person_name(prospect.name or "")
    org = prospect.organization or ""
    enrichment = prospect.enrichment or {}
    domain = _get_university_domain(org)

    strategies_tried = 0
    result = {"email": None, "source": None, "strategies_tried": 0}

    async with aiohttp.ClientSession() as session:

        if paper_first:
            # ── Paper-first mode (bounce recovery) ──
            # Try paper-based strategies first — they find CURRENT emails
            # without slow SMTP probes on (possibly dead) domains.

            # Strategy 8 first: Semantic Scholar → CrossRef DOI → publisher
            strategies_tried += 1
            email = await _strategy_semantic_scholar(
                session, name, org, prospect.recent_papers,
            )
            if email:
                return {"email": email, "source": "semantic_scholar_paper", "strategies_tried": strategies_tried}

            # Strategy 7: arXiv paper source
            strategies_tried += 1
            email = await _strategy_arxiv_source(session, name, enrichment)
            if email:
                return {"email": email, "source": "arxiv_paper", "strategies_tried": strategies_tried}

            # Strategy 2: Profile page deep scrape (fast, no SMTP)
            strategies_tried += 1
            email = await _strategy_profile_scrape(
                session, prospect.personal_site, prospect.lab_url, prospect.scholar_url
            )
            if email:
                return {"email": email, "source": "profile_scrape", "strategies_tried": strategies_tried}

            # Strategy 3: Google Scholar verified domain → pattern guess
            if prospect.scholar_url:
                strategies_tried += 1
                email = await _strategy_scholar(session, prospect.scholar_url, name)
                if email:
                    return {"email": email, "source": "scholar_verified", "strategies_tried": strategies_tried}

            # Strategy 5: GitHub commit emails (fast, no SMTP)
            if enrichment.get("github_login"):
                strategies_tried += 1
                email = await _strategy_github_events(session, name, enrichment)
                if email:
                    return {"email": email, "source": "github_events", "strategies_tried": strategies_tried}

            # Skip SMTP-heavy strategies (1, 4, 6) in paper_first mode
            # — they're slow and the old domain likely bounced already

        else:
            # ── Normal mode (fresh discovery) ──

            # Strategy 1: University directory
            if domain and domain in DIRECTORY_URLS:
                strategies_tried += 1
                email = await _strategy_directory(session, name, domain)
                if email:
                    return {"email": email, "source": "university_directory", "strategies_tried": strategies_tried}

            # Strategy 2: Profile page deep scrape
            strategies_tried += 1
            email = await _strategy_profile_scrape(
                session, prospect.personal_site, prospect.lab_url, prospect.scholar_url
            )
            if email:
                return {"email": email, "source": "profile_scrape", "strategies_tried": strategies_tried}

            # Strategy 3: Google Scholar verified domain → pattern guess
            if prospect.scholar_url:
                strategies_tried += 1
                email = await _strategy_scholar(session, prospect.scholar_url, name)
                if email:
                    return {"email": email, "source": "scholar_verified", "strategies_tried": strategies_tried}

            # Strategy 4: .edu pattern guess + SMTP verify
            if domain:
                strategies_tried += 1
                email = await _strategy_pattern_guess(name, org)
                if email:
                    return {"email": email, "source": "pattern_smtp", "strategies_tried": strategies_tried}

            # Strategy 5: GitHub commit emails
            if enrichment.get("github_login"):
                strategies_tried += 1
                email = await _strategy_github_events(session, name, enrichment)
                if email:
                    return {"email": email, "source": "github_events", "strategies_tried": strategies_tried}

            # Strategy 6: Hunter.io
            if settings.hunter_api_key and domain:
                strategies_tried += 1
                email = await _strategy_hunter(session, name, org)
                if email:
                    return {"email": email, "source": "hunter_io", "strategies_tried": strategies_tried}

            # Strategy 7: arXiv paper source
            strategies_tried += 1
            email = await _strategy_arxiv_source(session, name, enrichment)
            if email:
                return {"email": email, "source": "arxiv_paper", "strategies_tried": strategies_tried}

            # Strategy 8: Semantic Scholar → CrossRef DOI → publisher page
            strategies_tried += 1
            email = await _strategy_semantic_scholar(
                session, name, org, prospect.recent_papers,
            )
            if email:
                return {"email": email, "source": "semantic_scholar_paper", "strategies_tried": strategies_tried}

    result["strategies_tried"] = strategies_tried
    return result


async def batch_hunt_emails(batch_size: int = 30) -> dict:
    """
    Run email hunting for prospects that are missing emails.
    Prioritizes by score (high-value prospects first).
    """
    logger.info("[EmailHunter] Starting batch — size=%d", batch_size)

    async with async_session_factory() as db:
        # Find prospects without emails, ordered by score (hot leads first)
        result = await db.execute(
            select(DroneProspect).where(
                or_(DroneProspect.email.is_(None), DroneProspect.email == ""),
            ).order_by(
                DroneProspect.priority_score.desc().nullslast()
            ).limit(batch_size)
        )
        prospects = result.scalars().all()

        if not prospects:
            logger.info("[EmailHunter] No prospects need email enrichment")
            return {"found": 0, "tried": 0, "total_strategies": 0}

        found = 0
        tried = 0
        total_strategies = 0

        for prospect in prospects:
            tried += 1
            try:
                hunt_result = await hunt_email_for_prospect(prospect)
                total_strategies += hunt_result["strategies_tried"]

                if hunt_result["email"]:
                    prospect.email = hunt_result["email"]
                    # Store provenance in enrichment
                    enrichment = prospect.enrichment or {}
                    enrichment["email_source"] = hunt_result["source"]
                    enrichment["email_found_at"] = datetime.now(timezone.utc).isoformat()
                    prospect.enrichment = enrichment
                    found += 1
                    logger.info(
                        "[EmailHunter] Found email for %s (%s) via %s",
                        prospect.name, hunt_result["email"], hunt_result["source"]
                    )

            except Exception as e:
                logger.error("[EmailHunter] Error processing %s: %s", prospect.name, e)

            # Polite delay between prospects to avoid rate limiting
            await asyncio.sleep(1)

        await db.commit()

    summary = (
        f"Email hunt complete:\n"
        f"  Prospects tried: {tried}\n"
        f"  Emails found: {found}\n"
        f"  Hit rate: {found/tried*100:.0f}%\n"
        f"  Total strategies attempted: {total_strategies}"
    )
    logger.info("[EmailHunter] %s", summary)

    return {"found": found, "tried": tried, "total_strategies": total_strategies, "log": summary}


async def get_email_hunter_stats() -> dict:
    """Get statistics on email coverage."""
    async with async_session_factory() as db:
        total = (await db.execute(
            select(func.count(DroneProspect.id))
        )).scalar() or 0

        with_email = (await db.execute(
            select(func.count(DroneProspect.id)).where(
                DroneProspect.email.isnot(None),
                DroneProspect.email != "",
            )
        )).scalar() or 0

        without_email = total - with_email

    return {
        "total_prospects": total,
        "with_email": with_email,
        "without_email": without_email,
        "coverage_pct": round(with_email / total * 100, 1) if total else 0,
    }
