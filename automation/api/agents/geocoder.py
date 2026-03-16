"""
Geocoder Agent — Populates lat/lng for drone prospects based on organization.

Uses a built-in lookup table for well-known drone research universities,
then falls back to OpenStreetMap Nominatim for uncovered orgs.
Nominatim is free but rate-limited: 1 request/second, respectful User-Agent.
"""

import asyncio
import logging
import re
from datetime import datetime, timezone

import aiohttp
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import async_session_factory
from api.models.prospect import DroneProspect

logger = logging.getLogger("agents.geocoder")

# ── Well-known university coordinates (covers top drone research programs) ──
# Format: partial org name (lowercased) → (lat, lng, city, state, country)
UNIVERSITY_COORDS: dict[str, tuple[float, float, str, str, str]] = {
    "mit": (42.3601, -71.0942, "Cambridge", "MA", "US"),
    "massachusetts institute": (42.3601, -71.0942, "Cambridge", "MA", "US"),
    "stanford": (37.4275, -122.1697, "Stanford", "CA", "US"),
    "carnegie mellon": (40.4433, -79.9436, "Pittsburgh", "PA", "US"),
    "cmu": (40.4433, -79.9436, "Pittsburgh", "PA", "US"),
    "georgia tech": (33.7756, -84.3963, "Atlanta", "GA", "US"),
    "georgia institute": (33.7756, -84.3963, "Atlanta", "GA", "US"),
    "caltech": (34.1377, -118.1253, "Pasadena", "CA", "US"),
    "california institute of technology": (34.1377, -118.1253, "Pasadena", "CA", "US"),
    "uc berkeley": (37.8719, -122.2585, "Berkeley", "CA", "US"),
    "university of california, berkeley": (37.8719, -122.2585, "Berkeley", "CA", "US"),
    "ucsd": (32.8801, -117.2340, "La Jolla", "CA", "US"),
    "uc san diego": (32.8801, -117.2340, "La Jolla", "CA", "US"),
    "ucla": (34.0689, -118.4452, "Los Angeles", "CA", "US"),
    "uc davis": (38.5382, -121.7617, "Davis", "CA", "US"),
    "uc irvine": (33.6405, -117.8443, "Irvine", "CA", "US"),
    "uc santa barbara": (34.4140, -119.8489, "Santa Barbara", "CA", "US"),
    "usc": (34.0224, -118.2851, "Los Angeles", "CA", "US"),
    "university of southern california": (34.0224, -118.2851, "Los Angeles", "CA", "US"),
    "university of michigan": (42.2780, -83.7382, "Ann Arbor", "MI", "US"),
    "umich": (42.2780, -83.7382, "Ann Arbor", "MI", "US"),
    "university of pennsylvania": (39.9522, -75.1932, "Philadelphia", "PA", "US"),
    "upenn": (39.9522, -75.1932, "Philadelphia", "PA", "US"),
    "penn state": (40.7982, -77.8599, "State College", "PA", "US"),
    "princeton": (40.3573, -74.6672, "Princeton", "NJ", "US"),
    "cornell": (42.4534, -76.4735, "Ithaca", "NY", "US"),
    "columbia university": (40.8075, -73.9626, "New York", "NY", "US"),
    "harvard": (42.3770, -71.1167, "Cambridge", "MA", "US"),
    "yale": (41.3163, -72.9223, "New Haven", "CT", "US"),
    "johns hopkins": (39.3299, -76.6205, "Baltimore", "MD", "US"),
    "duke university": (36.0014, -78.9382, "Durham", "NC", "US"),
    "duke": (36.0014, -78.9382, "Durham", "NC", "US"),
    "university of texas": (30.2849, -97.7341, "Austin", "TX", "US"),
    "ut austin": (30.2849, -97.7341, "Austin", "TX", "US"),
    "texas a&m": (30.6187, -96.3365, "College Station", "TX", "US"),
    "tamu": (30.6187, -96.3365, "College Station", "TX", "US"),
    "purdue": (40.4237, -86.9212, "West Lafayette", "IN", "US"),
    "university of illinois": (40.1020, -88.2272, "Champaign", "IL", "US"),
    "uiuc": (40.1020, -88.2272, "Champaign", "IL", "US"),
    "ohio state": (39.9995, -83.0146, "Columbus", "OH", "US"),
    "university of maryland": (38.9869, -76.9426, "College Park", "MD", "US"),
    "umd": (38.9869, -76.9426, "College Park", "MD", "US"),
    "virginia tech": (37.2296, -80.4139, "Blacksburg", "VA", "US"),
    "university of virginia": (38.0336, -78.5080, "Charlottesville", "VA", "US"),
    "north carolina state": (35.7847, -78.6821, "Raleigh", "NC", "US"),
    "nc state": (35.7847, -78.6821, "Raleigh", "NC", "US"),
    "university of florida": (29.6436, -82.3549, "Gainesville", "FL", "US"),
    "university of washington": (47.6553, -122.3035, "Seattle", "WA", "US"),
    "uw": (47.6553, -122.3035, "Seattle", "WA", "US"),
    "university of colorado": (40.0076, -105.2659, "Boulder", "CO", "US"),
    "cu boulder": (40.0076, -105.2659, "Boulder", "CO", "US"),
    "arizona state": (33.4242, -111.9281, "Tempe", "AZ", "US"),
    "asu": (33.4242, -111.9281, "Tempe", "AZ", "US"),
    "university of arizona": (32.2319, -110.9501, "Tucson", "AZ", "US"),
    "clemson": (34.6834, -82.8374, "Clemson", "SC", "US"),
    "drexel": (39.9566, -75.1899, "Philadelphia", "PA", "US"),
    "university of minnesota": (44.9740, -93.2277, "Minneapolis", "MN", "US"),
    "university of wisconsin": (43.0766, -89.4125, "Madison", "WI", "US"),
    "northwestern": (42.0565, -87.6753, "Evanston", "IL", "US"),
    "rice university": (29.7174, -95.4018, "Houston", "TX", "US"),
    "university of pittsburgh": (40.4444, -79.9608, "Pittsburgh", "PA", "US"),
    "boston university": (42.3505, -71.1054, "Boston", "MA", "US"),
    "boston college": (42.3355, -71.1685, "Chestnut Hill", "MA", "US"),
    "northeastern university": (42.3398, -71.0892, "Boston", "MA", "US"),
    "university of utah": (40.7649, -111.8421, "Salt Lake City", "UT", "US"),
    "brigham young": (40.2519, -111.6493, "Provo", "UT", "US"),
    "byu": (40.2519, -111.6493, "Provo", "UT", "US"),
    "university of nebraska": (40.8202, -96.7005, "Lincoln", "NE", "US"),
    "iowa state": (42.0267, -93.6465, "Ames", "IA", "US"),
    "kansas state": (39.1974, -96.5847, "Manhattan", "KS", "US"),
    "oregon state": (44.5646, -123.2620, "Corvallis", "OR", "US"),
    "university of oregon": (44.0448, -123.0726, "Eugene", "OR", "US"),
    "washington state": (46.7298, -117.1817, "Pullman", "WA", "US"),
    "wsu": (46.7298, -117.1817, "Pullman", "WA", "US"),
    "university of north carolina": (35.9049, -79.0469, "Chapel Hill", "NC", "US"),
    "unc": (35.9049, -79.0469, "Chapel Hill", "NC", "US"),
    "university of notre dame": (41.7002, -86.2379, "Notre Dame", "IN", "US"),
    "notre dame": (41.7002, -86.2379, "Notre Dame", "IN", "US"),
    "university of cincinnati": (39.1329, -84.5150, "Cincinnati", "OH", "US"),
    "rensselaer": (42.7298, -73.6789, "Troy", "NY", "US"),
    "rpi": (42.7298, -73.6789, "Troy", "NY", "US"),
    "worcester polytechnic": (42.2746, -71.8063, "Worcester", "MA", "US"),
    "wpi": (42.2746, -71.8063, "Worcester", "MA", "US"),
    # International
    "eth zurich": (47.3769, 8.5417, "Zurich", "", "CH"),
    "eth zürich": (47.3769, 8.5417, "Zurich", "", "CH"),
    "epfl": (46.5197, 6.5660, "Lausanne", "", "CH"),
    "oxford": (51.7520, -1.2577, "Oxford", "", "GB"),
    "cambridge university": (52.2043, 0.1149, "Cambridge", "", "GB"),
    "imperial college": (51.4988, -0.1749, "London", "", "GB"),
    "university of toronto": (43.6629, -79.3957, "Toronto", "ON", "CA"),
    "u of t": (43.6629, -79.3957, "Toronto", "ON", "CA"),
    "mcgill": (45.5048, -73.5772, "Montreal", "QC", "CA"),
    "university of waterloo": (43.4723, -80.5449, "Waterloo", "ON", "CA"),
    "concordia": (45.4972, -73.5790, "Montreal", "QC", "CA"),
    "university of british columbia": (49.2606, -123.2460, "Vancouver", "BC", "CA"),
    "ubc": (49.2606, -123.2460, "Vancouver", "BC", "CA"),
    "delft": (52.0116, 4.3571, "Delft", "", "NL"),
    "tu delft": (52.0116, 4.3571, "Delft", "", "NL"),
    "tsinghua": (39.9999, 116.3267, "Beijing", "", "CN"),
    "peking university": (39.9869, 116.3059, "Beijing", "", "CN"),
    "fudan": (31.2984, 121.5010, "Shanghai", "", "CN"),
    "university of tokyo": (35.7126, 139.7620, "Tokyo", "", "JP"),
    "tokyo institute": (35.6042, 139.6837, "Tokyo", "", "JP"),
    "kaist": (36.3720, 127.3604, "Daejeon", "", "KR"),
    "seoul national": (37.4520, 126.9522, "Seoul", "", "KR"),
    "national university of singapore": (1.2966, 103.7764, "Singapore", "", "SG"),
    "nus": (1.2966, 103.7764, "Singapore", "", "SG"),
    "nanyang technological": (1.3483, 103.6831, "Singapore", "", "SG"),
    "ntu singapore": (1.3483, 103.6831, "Singapore", "", "SG"),
    "iit": (19.1334, 72.9133, "Mumbai", "", "IN"),
    "indian institute of technology": (28.5456, 77.1926, "New Delhi", "", "IN"),
    "technion": (32.7775, 35.0217, "Haifa", "", "IL"),
    "university of melbourne": (-37.7964, 144.9612, "Melbourne", "VIC", "AU"),
    "university of sydney": (-33.8886, 151.1873, "Sydney", "NSW", "AU"),
    "university of queensland": (-27.4975, 153.0137, "Brisbane", "QLD", "AU"),
    # Defense/gov
    "air force research": (39.7817, -84.0833, "Dayton", "OH", "US"),
    "afrl": (39.7817, -84.0833, "Dayton", "OH", "US"),
    "naval research": (38.8224, -77.0199, "Washington", "DC", "US"),
    "nrl": (38.8224, -77.0199, "Washington", "DC", "US"),
    "army research": (39.0151, -76.9376, "Adelphi", "MD", "US"),
    "arl": (39.0151, -76.9376, "Adelphi", "MD", "US"),
    "nasa": (28.5721, -80.6480, "Cape Canaveral", "FL", "US"),
    "jpl": (34.2000, -118.1745, "Pasadena", "CA", "US"),
    "jet propulsion": (34.2000, -118.1745, "Pasadena", "CA", "US"),
    # Companies in drone space
    "auterion": (47.3769, 8.5417, "Zurich", "", "CH"),
    "dji": (22.5431, 114.0579, "Shenzhen", "", "CN"),
    "skydio": (37.3833, -122.0667, "San Mateo", "CA", "US"),
    "wing": (37.4220, -122.0841, "Mountain View", "CA", "US"),
    "amazon prime air": (47.6062, -122.3321, "Seattle", "WA", "US"),
    "zipline": (37.7749, -122.4194, "San Francisco", "CA", "US"),
    # More universities
    "bethune cookman": (29.2108, -81.0229, "Daytona Beach", "FL", "US"),
    "coventry university": (52.4068, -1.5197, "Coventry", "", "GB"),
    "chosun university": (35.1440, 126.9288, "Gwangju", "", "KR"),
    "bennett university": (28.4595, 77.5012, "Greater Noida", "", "IN"),
    "capital university of science": (33.6844, 73.0479, "Islamabad", "", "PK"),
    "nit jalandhar": (31.3965, 75.5351, "Jalandhar", "", "IN"),
    "national institute of technology jalandhar": (31.3965, 75.5351, "Jalandhar", "", "IN"),
}

# Patterns that indicate the org field is NOT a real organization
SKIP_PATTERNS = re.compile(
    r"^(@|unknown|assistant professor|associate professor|professor |"
    r"doctoral candidate|college of engineering$|department of|"
    r"researcher |phd |postdoc|center for)",
    re.IGNORECASE,
)


def _lookup_org(org: str) -> tuple[float, float, str, str, str] | None:
    """Try to find coordinates from the static lookup table."""
    org_lower = org.lower().strip()
    # Direct match
    for key, coords in UNIVERSITY_COORDS.items():
        if key in org_lower:
            return coords
    return None


async def _nominatim_geocode(
    org: str, session: aiohttp.ClientSession
) -> tuple[float, float, str, str, str] | None:
    """Geocode an organization name via OpenStreetMap Nominatim (free, 1 req/s)."""
    # Clean the org name for better results
    clean = re.sub(r"\(.*?\)", "", org).strip()
    if len(clean) < 4:
        return None

    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": clean,
        "format": "json",
        "limit": 1,
        "addressdetails": 1,
    }
    headers = {"User-Agent": "AJBuildsDrone-Geocoder/1.0 (research outreach tool)"}

    try:
        async with session.get(url, params=params, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                return None
            data = await resp.json()
            if not data:
                return None
            result = data[0]
            lat = float(result["lat"])
            lon = float(result["lon"])
            addr = result.get("address", {})
            city = addr.get("city") or addr.get("town") or addr.get("village") or ""
            state = addr.get("state") or ""
            country = addr.get("country_code", "").upper()
            return (lat, lon, city, state, country)
    except Exception as e:
        logger.debug("Nominatim failed for %r: %s", org, e)
        return None


async def execute_geocoding_cycle(batch_size: int = 100) -> dict:
    """
    Geocode drone prospects that have organization but no lat/lng.
    Uses static lookup first, then Nominatim for the rest.

    Returns: {"geocoded": int, "skipped": int, "failed": int, "log": str}
    """
    geocoded = 0
    skipped = 0
    failed = 0
    nominatim_count = 0

    # Cache: org → coords (avoid re-geocoding same university)
    org_cache: dict[str, tuple[float, float, str, str, str] | None] = {}

    async with async_session_factory() as db:
        # Get prospects without coordinates
        result = await db.execute(
            select(DroneProspect)
            .where(
                DroneProspect.lat.is_(None),
                DroneProspect.status != "merged",
                DroneProspect.organization.isnot(None),
            )
            .order_by(DroneProspect.priority_score.desc().nullslast())
            .limit(batch_size)
        )
        prospects = list(result.scalars().all())

        if not prospects:
            return {"geocoded": 0, "skipped": 0, "failed": 0, "log": "No prospects to geocode."}

        async with aiohttp.ClientSession() as http:
            for p in prospects:
                org = (p.organization or "").strip()

                # Skip junk org values
                if not org or SKIP_PATTERNS.match(org):
                    skipped += 1
                    continue

                # Check cache first
                if org in org_cache:
                    coords = org_cache[org]
                else:
                    # Try static lookup
                    coords = _lookup_org(org)
                    if coords is None:
                        # Fall back to Nominatim (with rate limit)
                        if nominatim_count < 50:  # Cap Nominatim calls per cycle
                            coords = await _nominatim_geocode(org, http)
                            nominatim_count += 1
                            await asyncio.sleep(1.1)  # Respect rate limit
                    org_cache[org] = coords

                if coords:
                    lat, lng, city, state, country = coords
                    p.lat = lat
                    p.lng = lng
                    if not p.city:
                        p.city = city
                    if not p.state:
                        p.state = state
                    if not p.country or p.country == "US":
                        p.country = country
                    p.updated_at = datetime.now(timezone.utc)
                    geocoded += 1
                else:
                    failed += 1

        await db.commit()

    log = (
        f"Geocoding cycle completed:\n"
        f"  - Geocoded: {geocoded}\n"
        f"  - Skipped (bad org): {skipped}\n"
        f"  - Failed (no match): {failed}\n"
        f"  - Nominatim calls: {nominatim_count}\n"
    )
    logger.info(log)
    return {"geocoded": geocoded, "skipped": skipped, "failed": failed, "log": log}
