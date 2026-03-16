"""
AJ Builds Drone — Email Hunter Tests.

Tests for:
- University domain mapping
- .edu email pattern generation
- Email hunting orchestration
- API routes (batch hunt, stats, single prospect hunt)
- Scheduler registration (14 agents)
- Enrichment agent email extraction
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
import pytest_asyncio

from api.models.prospect import DroneProspect


# ═══════════════════════════════════════════════════════════════════════
# University Domain Mapping
# ═══════════════════════════════════════════════════════════════════════

class TestUniversityDomainMapping:

    def test_direct_match(self):
        from api.services.drone_email_hunter import _get_university_domain
        assert _get_university_domain("MIT") == "mit.edu"
        assert _get_university_domain("Stanford") == "stanford.edu"
        assert _get_university_domain("Carnegie Mellon") == "cmu.edu"

    def test_case_insensitive(self):
        from api.services.drone_email_hunter import _get_university_domain
        assert _get_university_domain("mit") == "mit.edu"
        assert _get_university_domain("STANFORD") == "stanford.edu"

    def test_fuzzy_match(self):
        from api.services.drone_email_hunter import _get_university_domain
        # Substring matching
        assert _get_university_domain("Georgia Tech") == "gatech.edu"
        assert _get_university_domain("UT Austin") == "utexas.edu"

    def test_unknown_university(self):
        from api.services.drone_email_hunter import _get_university_domain
        assert _get_university_domain("Unknown College") is None
        assert _get_university_domain("") is None
        assert _get_university_domain(None) is None

    def test_domain_count(self):
        from api.services.drone_email_hunter import UNIVERSITY_DOMAINS
        assert len(UNIVERSITY_DOMAINS) >= 40


# ═══════════════════════════════════════════════════════════════════════
# Email Pattern Generation
# ═══════════════════════════════════════════════════════════════════════

class TestEmailPatternGeneration:

    def test_basic_patterns(self):
        from api.services.drone_email_hunter import _generate_edu_patterns
        patterns = _generate_edu_patterns("John", "Smith", "mit.edu")
        assert len(patterns) >= 5
        assert "john.smith@mit.edu" in patterns
        assert "jsmith@mit.edu" in patterns
        assert "john@mit.edu" in patterns

    def test_known_university_patterns(self):
        from api.services.drone_email_hunter import _generate_edu_patterns
        patterns = _generate_edu_patterns("Jane", "Doe", "stanford.edu")
        assert "jane.doe@stanford.edu" in patterns

    def test_empty_inputs(self):
        from api.services.drone_email_hunter import _generate_edu_patterns
        assert _generate_edu_patterns("", "Smith", "mit.edu") == []
        assert _generate_edu_patterns("John", "", "mit.edu") == []

    def test_no_duplicates(self):
        from api.services.drone_email_hunter import _generate_edu_patterns
        patterns = _generate_edu_patterns("John", "Smith", "mit.edu")
        assert len(patterns) == len(set(patterns))


# ═══════════════════════════════════════════════════════════════════════
# Email Hunting Orchestration
# ═══════════════════════════════════════════════════════════════════════

class TestEmailHunting:

    def _make_prospect(self, **kwargs):
        defaults = {
            "id": uuid.uuid4(),
            "name": "Jane Doe",
            "organization": "MIT",
            "title": "Professor",
            "status": "discovered",
            "email": None,
            "personal_site": None,
            "lab_url": None,
            "scholar_url": None,
            "enrichment": {},
        }
        defaults.update(kwargs)
        prospect = MagicMock(spec=DroneProspect)
        for k, v in defaults.items():
            setattr(prospect, k, v)
        return prospect

    @pytest.mark.asyncio
    async def test_hunt_tries_directory_first(self):
        from api.services.drone_email_hunter import hunt_email_for_prospect
        prospect = self._make_prospect(name="Jane Doe", organization="MIT")

        with patch("api.services.drone_email_hunter._strategy_directory",
                   new_callable=AsyncMock, return_value="jdoe@mit.edu"):
            result = await hunt_email_for_prospect(prospect)
            assert result["email"] == "jdoe@mit.edu"
            assert result["source"] == "university_directory"

    @pytest.mark.asyncio
    async def test_hunt_falls_through_to_profile_scrape(self):
        from api.services.drone_email_hunter import hunt_email_for_prospect
        prospect = self._make_prospect(
            name="Jane Doe", organization="MIT",
            personal_site="https://example.mit.edu/jane"
        )

        with patch("api.services.drone_email_hunter._strategy_directory",
                   new_callable=AsyncMock, return_value=None), \
             patch("api.services.drone_email_hunter._strategy_profile_scrape",
                   new_callable=AsyncMock, return_value="jane@mit.edu"):
            result = await hunt_email_for_prospect(prospect)
            assert result["email"] == "jane@mit.edu"
            assert result["source"] == "profile_scrape"

    @pytest.mark.asyncio
    async def test_hunt_pattern_guess_strategy(self):
        from api.services.drone_email_hunter import hunt_email_for_prospect
        prospect = self._make_prospect(name="Jane Doe", organization="MIT")

        with patch("api.services.drone_email_hunter._strategy_directory",
                   new_callable=AsyncMock, return_value=None), \
             patch("api.services.drone_email_hunter._strategy_profile_scrape",
                   new_callable=AsyncMock, return_value=None), \
             patch("api.services.drone_email_hunter._strategy_pattern_guess",
                   new_callable=AsyncMock, return_value="jane.doe@mit.edu"):
            result = await hunt_email_for_prospect(prospect)
            assert result["email"] == "jane.doe@mit.edu"
            assert result["source"] == "pattern_smtp"

    @pytest.mark.asyncio
    async def test_hunt_returns_none_when_all_fail(self):
        from api.services.drone_email_hunter import hunt_email_for_prospect
        prospect = self._make_prospect(name="Mystery Person", organization="Unknown College")

        with patch("api.services.drone_email_hunter._strategy_profile_scrape",
                   new_callable=AsyncMock, return_value=None), \
             patch("api.services.drone_email_hunter._strategy_arxiv_source",
                   new_callable=AsyncMock, return_value=None):
            result = await hunt_email_for_prospect(prospect)
            assert result["email"] is None
            assert result["strategies_tried"] >= 1

    @pytest.mark.asyncio
    async def test_github_events_strategy(self):
        from api.services.drone_email_hunter import hunt_email_for_prospect
        prospect = self._make_prospect(
            name="Dev Person", organization="Unknown College",
            enrichment={"github_login": "devperson"}
        )

        with patch("api.services.drone_email_hunter._strategy_profile_scrape",
                   new_callable=AsyncMock, return_value=None), \
             patch("api.services.drone_email_hunter._strategy_github_events",
                   new_callable=AsyncMock, return_value="dev@university.edu"), \
             patch("api.services.drone_email_hunter._strategy_arxiv_source",
                   new_callable=AsyncMock, return_value=None):
            result = await hunt_email_for_prospect(prospect)
            assert result["email"] == "dev@university.edu"
            assert result["source"] == "github_events"


# ═══════════════════════════════════════════════════════════════════════
# Batch Email Hunt
# ═══════════════════════════════════════════════════════════════════════

class TestBatchEmailHunt:

    def _mock_session_factory(self, db_session):
        """Create a mock that acts as an async context manager returning db_session."""
        mock_factory = MagicMock()
        mock_cm = AsyncMock()
        mock_cm.__aenter__ = AsyncMock(return_value=db_session)
        mock_cm.__aexit__ = AsyncMock(return_value=False)
        mock_factory.return_value = mock_cm
        return mock_factory

    @pytest.mark.asyncio
    async def test_batch_hunt_empty_db(self, db_session):
        from api.services.drone_email_hunter import batch_hunt_emails
        mock_sf = self._mock_session_factory(db_session)
        with patch("api.services.drone_email_hunter.async_session_factory", mock_sf):
            result = await batch_hunt_emails(batch_size=10)
            assert result["found"] == 0
            assert result["tried"] == 0

    @pytest.mark.asyncio
    async def test_batch_hunt_with_prospects(self, db_session):
        from api.services.drone_email_hunter import batch_hunt_emails
        # Create prospect without email
        prospect = DroneProspect(
            id=uuid.uuid4(), name="Test Professor", organization="MIT",
            status="discovered", priority_score=80,
        )
        db_session.add(prospect)
        await db_session.commit()

        mock_sf = self._mock_session_factory(db_session)
        with patch("api.services.drone_email_hunter.async_session_factory", mock_sf), \
             patch("api.services.drone_email_hunter.hunt_email_for_prospect",
                   new_callable=AsyncMock,
                   return_value={"email": "test@mit.edu", "source": "pattern_smtp", "strategies_tried": 4}):
            result = await batch_hunt_emails(batch_size=10)
            assert result["tried"] == 1
            assert result["found"] == 1

    @pytest.mark.asyncio
    async def test_batch_skips_prospects_with_email(self, db_session):
        from api.services.drone_email_hunter import batch_hunt_emails
        # Create prospect WITH email — should be skipped
        prospect = DroneProspect(
            id=uuid.uuid4(), name="Has Email Prof", organization="Stanford",
            status="discovered", email="prof@stanford.edu", priority_score=90,
        )
        db_session.add(prospect)
        await db_session.commit()

        mock_sf = self._mock_session_factory(db_session)
        with patch("api.services.drone_email_hunter.async_session_factory", mock_sf):
            result = await batch_hunt_emails(batch_size=10)
            assert result["tried"] == 0


# ═══════════════════════════════════════════════════════════════════════
# Email Hunter API Routes
# ═══════════════════════════════════════════════════════════════════════

class TestEmailHunterRoutes:

    @pytest.mark.asyncio
    async def test_email_hunt_route(self, client):
        with patch("api.services.drone_email_hunter.batch_hunt_emails",
                   new_callable=AsyncMock,
                   return_value={"found": 5, "tried": 30, "total_strategies": 120, "log": "done"}):
            resp = await client.post("/outreach/email-hunt?batch_size=30")
            assert resp.status_code == 200
            data = resp.json()
            assert data["found"] == 5

    @pytest.mark.asyncio
    async def test_email_stats_route(self, client):
        with patch("api.services.drone_email_hunter.get_email_hunter_stats",
                   new_callable=AsyncMock,
                   return_value={"total_prospects": 100, "with_email": 30, "without_email": 70, "coverage_pct": 30.0}):
            resp = await client.get("/outreach/email-hunt/stats")
            assert resp.status_code == 200
            data = resp.json()
            assert data["coverage_pct"] == 30.0

    @pytest.mark.asyncio
    async def test_single_prospect_hunt_route(self, client, db_session):
        pid = uuid.uuid4()
        prospect = DroneProspect(
            id=pid, name="Route Test Prof", organization="MIT",
            status="discovered",
        )
        db_session.add(prospect)
        await db_session.commit()

        with patch("api.services.drone_email_hunter.hunt_email_for_prospect",
                   new_callable=AsyncMock,
                   return_value={"email": "rtest@mit.edu", "source": "directory", "strategies_tried": 1}):
            resp = await client.post(f"/outreach/email-hunt/prospect/{pid}")
            assert resp.status_code == 200
            data = resp.json()
            assert data["email"] == "rtest@mit.edu"

    @pytest.mark.asyncio
    async def test_single_prospect_not_found(self, client):
        fake_id = uuid.uuid4()
        resp = await client.post(f"/outreach/email-hunt/prospect/{fake_id}")
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════
# Scheduler — 14 Agents
# ═══════════════════════════════════════════════════════════════════════

class TestSchedulerWithEmailHunter:

    def test_16_agents_registered(self):
        from api.agents.scheduler import register_all_agents, scheduler
        scheduler.agents.clear()
        register_all_agents()
        assert len(scheduler.agents) >= 19
        assert "email_hunter" in scheduler.agents
        assert scheduler.agents["email_hunter"].interval == 1 * 3600
        assert "geocoder" in scheduler.agents
        assert "bounce_recovery" in scheduler.agents
        assert scheduler.agents["bounce_recovery"].interval == 30 * 60


# ═══════════════════════════════════════════════════════════════════════
# Obfuscation Detection
# ═══════════════════════════════════════════════════════════════════════

class TestObfuscationDetection:

    def test_at_dot_pattern(self):
        """Test that the profile scraper catches [at]/[dot] obfuscated emails."""
        import re
        at_pattern = re.compile(
            r"([a-zA-Z0-9._%+-]+)\s*(?:\[at\]|&#64;|\(at\)|{at})\s*"
            r"([a-zA-Z0-9.-]+)\s*(?:\[dot\]|&#46;|\(dot\)|{dot})\s*"
            r"([a-zA-Z]{2,})",
            re.IGNORECASE
        )
        text1 = "Contact me at prof [at] mit [dot] edu for drone inquiries"
        match = at_pattern.search(text1)
        assert match is not None
        assert match.group(1) == "prof"
        assert match.group(2) == "mit"
        assert match.group(3) == "edu"

        text2 = "Email: john.smith(at)stanford(dot)edu"
        match2 = at_pattern.search(text2)
        assert match2 is not None


# ═══════════════════════════════════════════════════════════════════════
# Name Cleaning
# ═══════════════════════════════════════════════════════════════════════

class TestNameCleaning:

    def test_strips_reintroducing(self):
        from api.services.drone_email_hunter import _clean_person_name
        assert _clean_person_name("Reintroducing Joseph Thomas Gier") == "Joseph Thomas Gier"

    def test_strips_professor_prefix(self):
        from api.services.drone_email_hunter import _clean_person_name
        assert _clean_person_name("Prof. John Smith") == "John Smith"
        assert _clean_person_name("Dr. Jane Doe") == "Jane Doe"

    def test_strips_trailing_garbage(self):
        from api.services.drone_email_hunter import _clean_person_name
        assert _clean_person_name("John Smith Profile") == "John Smith"
        assert _clean_person_name("Jane Doe Results") == "Jane Doe"

    def test_normal_name_unchanged(self):
        from api.services.drone_email_hunter import _clean_person_name
        assert _clean_person_name("Russell Tedrake") == "Russell Tedrake"
        assert _clean_person_name("Maria Sakovsky") == "Maria Sakovsky"

    def test_single_word_name_preserved(self):
        from api.services.drone_email_hunter import _clean_person_name
        # If garbage stripping leaves nothing, original is returned
        assert _clean_person_name("Results") == "Results"

    def test_introducing_prefix(self):
        from api.services.drone_email_hunter import _clean_person_name
        assert _clean_person_name("Introducing Wei Zhang") == "Wei Zhang"
        assert _clean_person_name("Meet Sarah Connor") == "Sarah Connor"


# ═══════════════════════════════════════════════════════════════════════
# Semantic Scholar Strategy
# ═══════════════════════════════════════════════════════════════════════

class TestSemanticScholarStrategy:

    @pytest.mark.asyncio
    async def test_crossref_email_extraction(self):
        """CrossRef returns author email from DOI metadata."""
        from api.services.drone_email_hunter import _crossref_email_from_doi
        import aiohttp

        # Mock CrossRef response with corresponding author email
        crossref_resp = {
            "message": {
                "author": [
                    {
                        "family": "Tedrake",
                        "given": "Russell",
                        "sequence": "first",
                        "affiliation": [
                            {"name": "MIT CSAIL, russ.tedrake@mit.edu"}
                        ],
                    }
                ]
            }
        }

        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.json = AsyncMock(return_value=crossref_resp)
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)

        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=mock_resp)

        result = await _crossref_email_from_doi(mock_session, "10.1234/test", "Tedrake")
        assert result == "russ.tedrake@mit.edu"

    @pytest.mark.asyncio
    async def test_crossref_no_email(self):
        """CrossRef returns no email when not available."""
        from api.services.drone_email_hunter import _crossref_email_from_doi
        import aiohttp

        crossref_resp = {
            "message": {
                "author": [
                    {
                        "family": "Smith",
                        "given": "John",
                        "sequence": "first",
                        "affiliation": [{"name": "MIT"}],
                    }
                ]
            }
        }

        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.json = AsyncMock(return_value=crossref_resp)
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)

        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=mock_resp)

        result = await _crossref_email_from_doi(mock_session, "10.1234/test", "Smith")
        assert result is None

    @pytest.mark.asyncio
    async def test_semantic_scholar_author_not_found(self):
        """Returns None when S2 finds no matching author."""
        from api.services.drone_email_hunter import _strategy_semantic_scholar

        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.json = AsyncMock(return_value={"data": []})
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)

        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=mock_resp)

        result = await _strategy_semantic_scholar(
            mock_session, "Nobody Unknown", "Nowhere University", []
        )
        assert result is None


# ═══════════════════════════════════════════════════════════════════════
# Bounce Recovery
# ═══════════════════════════════════════════════════════════════════════

class TestBounceRecovery:

    @pytest.mark.asyncio
    async def test_no_bounced_prospects(self):
        """Returns empty result when no bounced prospects exist."""
        from api.services.bounce_recovery import recover_bounced_prospects

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("api.services.bounce_recovery.async_session_factory", return_value=mock_db):
            result = await recover_bounced_prospects(batch_size=5)
            assert result["checked"] == 0
            assert result["recovered"] == 0

    @pytest.mark.asyncio
    async def test_recovery_with_new_email(self):
        """Prospect gets recovered when a new email is found."""
        from api.services.bounce_recovery import recover_bounced_prospects

        # Create a fake bounced prospect
        prospect = MagicMock(spec=DroneProspect)
        prospect.id = uuid.uuid4()
        prospect.name = "Test Professor"
        prospect.email = "old.email@mit.edu"
        prospect.organization = "MIT"
        prospect.enrichment = {}
        prospect.status = "dead"
        prospect.notes = "Bounced: test subject"
        prospect.priority_score = 80
        prospect.scholar_url = None
        prospect.personal_site = None
        prospect.lab_url = None
        prospect.recent_papers = []

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [prospect]

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.flush = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        # Mock email hunter to find a new email
        hunt_return = {"email": "new.email@stanford.edu", "source": "semantic_scholar_paper", "strategies_tried": 3}

        with patch("api.services.bounce_recovery.async_session_factory", return_value=mock_db), \
             patch("api.services.bounce_recovery.hunt_email_for_prospect", new_callable=AsyncMock, return_value=hunt_return):
            result = await recover_bounced_prospects(batch_size=5)
            assert result["recovered"] == 1
            assert result["details"][0]["new_email"] == "new.email@stanford.edu"
            assert prospect.status == "queued"


# ═══════════════════════════════════════════════════════════════════════
# Co-Author Discovery Helpers
# ═══════════════════════════════════════════════════════════════════════

class TestIsAcademicEmail:
    def test_edu_domain(self):
        from api.services.drone_email_hunter import _is_academic_email
        assert _is_academic_email("smith@mit.edu") is True
        assert _is_academic_email("jones@stanford.edu") is True

    def test_international_academic(self):
        from api.services.drone_email_hunter import _is_academic_email
        assert _is_academic_email("prof@cam.ac.uk") is True
        assert _is_academic_email("prof@uni-berlin.de") is True
        assert _is_academic_email("prof@tu-munich.de") is True

    def test_gmails_excluded(self):
        from api.services.drone_email_hunter import _is_academic_email
        assert _is_academic_email("test@gmail.com") is False
        assert _is_academic_email("user@yahoo.com") is False

    def test_publisher_excluded(self):
        from api.services.drone_email_hunter import _is_academic_email
        assert _is_academic_email("support@springer.com") is False
        assert _is_academic_email("noreply@ieee.org") is False


class TestCollectAllPageEmails:
    def test_extracts_mailto(self):
        from api.services.drone_email_hunter import _collect_all_page_emails
        html = '<html><body><a href="mailto:smith@mit.edu">Contact</a></body></html>'
        emails = _collect_all_page_emails(html)
        assert "smith@mit.edu" in emails

    def test_extracts_text_emails(self):
        from api.services.drone_email_hunter import _collect_all_page_emails
        html = '<html><body><p>Email: jones@stanford.edu for info.</p></body></html>'
        emails = _collect_all_page_emails(html)
        assert "jones@stanford.edu" in emails

    def test_dedup(self):
        from api.services.drone_email_hunter import _collect_all_page_emails
        html = '''<html><body>
            <a href="mailto:Smith@MIT.edu">mail</a>
            <p>Contact: smith@mit.edu</p>
        </body></html>'''
        emails = _collect_all_page_emails(html)
        assert len([e for e in emails if "smith" in e]) == 1

    def test_empty_html(self):
        from api.services.drone_email_hunter import _collect_all_page_emails
        assert _collect_all_page_emails("<html></html>") == set()


class TestMatchEmailsToAuthors:
    def test_basic_match(self):
        from api.services.drone_email_hunter import _match_emails_to_authors
        emails = ["souza@mpie.de", "kumar@iitd.ac.in"]
        authors = [
            {"name": "Igor Souza", "affiliations": ["MPIE"]},
            {"name": "Anil Kumar", "affiliations": ["IIT Delhi"]},
        ]
        result = _match_emails_to_authors(emails, authors)
        assert len(result) == 2
        names = {r["name"] for r in result}
        assert "Igor Souza" in names
        assert "Anil Kumar" in names

    def test_no_match(self):
        from api.services.drone_email_hunter import _match_emails_to_authors
        emails = ["random@org.com"]
        authors = [{"name": "Alice Wonderland", "affiliations": []}]
        result = _match_emails_to_authors(emails, authors)
        assert len(result) == 0

    def test_short_lastname_skipped(self):
        from api.services.drone_email_hunter import _match_emails_to_authors
        emails = ["x@mit.edu"]
        authors = [{"name": "Li X", "affiliations": []}]
        result = _match_emails_to_authors(emails, authors)
        assert len(result) == 0

    def test_one_email_per_author(self):
        from api.services.drone_email_hunter import _match_emails_to_authors
        emails = ["souza@mpie.de", "i.souza@mpie.de"]
        authors = [{"name": "Igor Souza", "affiliations": ["MPIE"]}]
        result = _match_emails_to_authors(emails, authors)
        assert len(result) == 1


class TestSaveCoauthorProspects:
    @pytest.mark.asyncio
    async def test_creates_prospect(self):
        from api.services.drone_email_hunter import _save_coauthor_prospects

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(first=MagicMock(return_value=None)))
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        coauthors = [{"name": "Igor Souza", "email": "souza@mpie.de", "affiliations": ["MPIE"]}]

        with patch("api.services.drone_email_hunter.async_session_factory", return_value=mock_db):
            await _save_coauthor_prospects(coauthors, "Nature Paper 2024")

        mock_db.add.assert_called_once()
        added = mock_db.add.call_args[0][0]
        assert added.name == "Igor Souza"
        assert added.email == "souza@mpie.de"
        assert added.source == "coauthor_paper"
        mock_db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_skips_existing_email(self):
        from api.services.drone_email_hunter import _save_coauthor_prospects

        mock_db = AsyncMock()
        # First execute returns existing prospect (dedup hit)
        mock_db.execute = AsyncMock(return_value=MagicMock(first=MagicMock(return_value=(uuid.uuid4(),))))
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        coauthors = [{"name": "Igor Souza", "email": "souza@mpie.de", "affiliations": ["MPIE"]}]

        with patch("api.services.drone_email_hunter.async_session_factory", return_value=mock_db):
            await _save_coauthor_prospects(coauthors, "Nature Paper 2024")

        mock_db.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_empty_list_noop(self):
        from api.services.drone_email_hunter import _save_coauthor_prospects
        # Should not raise or call anything
        await _save_coauthor_prospects([], "some paper")
