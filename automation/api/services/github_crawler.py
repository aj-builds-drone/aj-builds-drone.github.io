"""
GitHub Contributor Scraper — Discover drone engineers from PX4, ArduPilot, ROS2.

Uses the GitHub REST API to find active contributors to major drone/robotics
open-source repositories, extracts profile info, and creates DroneProspect
records for outreach.

Rate limit: 5,000/hour with PAT (unauthenticated: 60/hour).
"""

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

import aiohttp
from sqlalchemy import select

from api.config import settings
from api.database import async_session_factory
from api.models.prospect import DiscoveryBatch, DroneProspect

logger = logging.getLogger("drone.github_crawler")

# Target repositories — major open-source drone/robotics projects
TARGET_REPOS = [
    # PX4 ecosystem
    "PX4/PX4-Autopilot",
    "PX4/px4_ros_com",
    "PX4/px4_msgs",
    # ArduPilot ecosystem
    "ArduPilot/ardupilot",
    "ArduPilot/MAVProxy",
    # ROS2 / robotics
    "ros2/rclcpp",
    "ros2/ros2",
    "ros-planning/navigation2",
    # Gazebo / simulation
    "gazebosim/gz-sim",
    # Other drone frameworks
    "ethz-asl/rotors_simulator",
    "microsoft/AirSim",
    "DLR-RM/stable-baselines3",
    # ── Expanded: SLAM & perception ──
    "HKUST-Aerial-Robotics/VINS-Mono",
    "HKUST-Aerial-Robotics/VINS-Fusion",
    "hku-mars/FAST_LIO",
    "hku-mars/ikd-Tree",
    "uzh-rpg/rpg_svo_pro_open",
    "raulmur/ORB_SLAM2",
    "UZ-SLAMLab/ORB_SLAM3",
    # ── Expanded: drone-specific ──
    "crazyflie/crazyflie-firmware",
    "dji-sdk/Guidance-SDK-ROS",
    "mavlink/mavlink",
    "mavlink/MAVSDK",
    "PX4/PX4-SITL_gazebo-classic",
    "ethz-asl/mav_voxblox_planning",
    "tum-vision/lsd_slam",
    # ── Expanded: autonomy frameworks ──
    "autowarefoundation/autoware",
    "ApolloAuto/apollo",
    "ArduPilot/pymavlink",
    # ── Expanded: simulation & flight ──
    "betaflight/betaflight",
    "iNavFlight/inav",
    "cleanflight/cleanflight",
    # ── Research / .edu focused repos (added 2026-03-30) ──
    "kumarrobotics/msckf_vio",
    "KumarRobotics/kr_autonomous_flight",
    "utiasDSL/gym-pybullet-drones",
    "mit-acl/cadrl",
    "StanfordASL/AA274A",
    "ethz-asl/maplab",
    "ethz-asl/okvis",
    "ethz-asl/kalibr",
    "HKUST-Aerial-Robotics/Fast-Planner",
    "HKUST-Aerial-Robotics/ego-planner",
    "uzh-rpg/agile_autonomy",
    "uzh-rpg/event-based_vision_resources",
    "mit-biomimetics/Cheetah-Software",
    "utiasASRL/vtr3",
    "ntnu-arl/aerial_gym_simulator",
]

GH_API = "https://api.github.com"
CONTRIBUTORS_PER_REPO = 50  # Top N contributors per repo
DELAY_BETWEEN_REQUESTS = 0.5  # seconds

# Drone-related bio/description keywords for filtering
DRONE_BIO_KEYWORDS = {
    "drone", "uav", "robotics", "autonomous", "aerial", "fpga",
    "firmware", "embedded", "flight controller", "px4", "ardupilot",
    "ros", "slam", "navigation", "quadrotor", "pilot", "aerospace",
    "avionics", "unmanned", "lidar", "computer vision", "real-time",
    "perception", "swarm", "gazebo", "simulation",
}

if not settings.gh_token:
    logger.warning("GH_TOKEN not set — GitHub API limited to 60 requests/hour (unauthenticated)")


def _headers() -> dict:
    """Build GitHub API headers with auth if available."""
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    token = settings.gh_token
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


async def _fetch_json(session: aiohttp.ClientSession, url: str, params: dict = None) -> Optional[dict | list]:
    """Fetch JSON from GitHub API with rate limit awareness."""
    try:
        async with session.get(url, headers=_headers(), params=params) as resp:
            if resp.status == 403:
                remaining = resp.headers.get("X-RateLimit-Remaining", "0")
                if remaining == "0":
                    reset = int(resp.headers.get("X-RateLimit-Reset", "0"))
                    wait = max(reset - int(datetime.now(timezone.utc).timestamp()), 10)
                    wait = min(wait, 3600)  # cap at 1 hour
                    logger.warning("GitHub rate limited — sleeping %ds until reset", wait)
                    await asyncio.sleep(wait)
                    return None
                logger.warning("GitHub 403: %s", await resp.text())
                return None
            if resp.status != 200:
                logger.warning("GitHub %d for %s", resp.status, url)
                return None
            return await resp.json()
    except Exception as e:
        logger.error("GitHub fetch error: %s", e)
        return None


def _bio_is_drone_related(bio: str) -> bool:
    """Check if a GitHub user bio/description mentions drone-related topics."""
    if not bio:
        return False
    bio_lower = bio.lower()
    return sum(1 for kw in DRONE_BIO_KEYWORDS if kw in bio_lower) >= 2


def _extract_email_from_bio(bio: str) -> Optional[str]:
    """Try to extract email from bio text."""
    if not bio:
        return None
    match = re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', bio)
    return match.group(0) if match else None


def _infer_org_type(company: str) -> str:
    """Infer organization type from GitHub company field."""
    if not company:
        return "unknown"
    c = company.lower()
    # Check government/defense first (more specific) before university
    gov_keywords = ("nasa", "noaa", "army", "navy", "air force", "darpa",
                    "faa", "dod", "nist", "government")
    if any(k in c for k in gov_keywords):
        return "government"
    defense_keywords = ("lockheed", "northrop", "raytheon", "boeing", "l3harris",
                        "bae", "general atomics", "aerojet")
    if any(k in c for k in defense_keywords):
        return "defense_contractor"
    uni_keywords = ("university", "college", "institute", "lab", "research",
                    "mit", "stanford", "eth", "tu ", "ucsd", "caltech")
    if any(k in c for k in uni_keywords):
        return "university"
    return "startup"


async def crawl_github_contributors(repos: list[str] = None) -> dict:
    """
    Discover drone engineers from GitHub open-source contributors.

    Scans contributor lists for major drone repos, fetches profiles,
    filters by drone-related bios, and creates prospects.

    Returns: {batch_id, prospects_found, prospects_new, repos_scanned}
    """
    repos = repos or TARGET_REPOS

    async with async_session_factory() as db:
        batch = DiscoveryBatch(
            id=uuid4(), source="github", query=",".join(repos[:5]),
            status="running", started_at=datetime.now(timezone.utc),
        )
        db.add(batch)
        await db.commit()
        batch_id = str(batch.id)

    found = 0
    new = 0
    seen_logins = set()

    async with aiohttp.ClientSession() as http:
        for repo in repos:
            # Fetch top contributors
            url = f"{GH_API}/repos/{repo}/contributors"
            contributors = await _fetch_json(http, url, {"per_page": CONTRIBUTORS_PER_REPO, "anon": "false"})
            if not contributors:
                await asyncio.sleep(DELAY_BETWEEN_REQUESTS)
                continue

            for contrib in contributors:
                login = contrib.get("login", "")
                if not login or login in seen_logins or login.endswith("[bot]"):
                    continue
                seen_logins.add(login)

                # Rate limit: small delay
                await asyncio.sleep(DELAY_BETWEEN_REQUESTS)

                # Fetch full user profile
                user = await _fetch_json(http, f"{GH_API}/users/{login}")
                if not user:
                    continue

                name = user.get("name") or login
                bio = user.get("bio") or ""
                company = user.get("company") or ""
                email = user.get("email")
                location = user.get("location") or ""
                blog = user.get("blog") or ""

                # Filter: at least drone-related bio OR significant contributions
                contributions = contrib.get("contributions", 0)
                if not _bio_is_drone_related(bio) and contributions < 20:
                    continue

                found += 1

                # Try to extract email from bio if not public
                if not email:
                    email = _extract_email_from_bio(bio)

                org_type = _infer_org_type(company)

                # Research areas from bio
                research_areas = []
                for kw in DRONE_BIO_KEYWORDS:
                    if kw in (bio or "").lower():
                        research_areas.append(kw)

                async with async_session_factory() as db:
                    # Dedup by name + org or email
                    existing = None
                    if email:
                        result = await db.execute(
                            select(DroneProspect.id).where(DroneProspect.email == email).limit(1)
                        )
                        existing = result.first()
                    if not existing:
                        result = await db.execute(
                            select(DroneProspect.id).where(
                                DroneProspect.name == name,
                                DroneProspect.organization == (company or repo.split("/")[0]),
                            ).limit(1)
                        )
                        existing = result.first()

                    if existing:
                        continue

                    prospect = DroneProspect(
                        id=uuid4(),
                        name=name,
                        email=email,
                        organization=company or repo.split("/")[0],
                        organization_type=org_type,
                        title=f"Open-source contributor ({repo})",
                        status="discovered",
                        source="github",
                        source_url=user.get("html_url"),
                        personal_site=blog or None,
                        linkedin_url=None,
                        research_areas=research_areas[:10] if research_areas else None,
                        software_stack=_infer_stack(repo),
                        discovery_batch_id=uuid4(),
                        notes=f"GitHub: {contributions} contributions to {repo}. Bio: {bio[:200]}",
                        enrichment={"github_login": login, "contributions": contributions, "repos": [repo]},
                    )
                    db.add(prospect)
                    await db.commit()
                    new += 1

            logger.info("GitHub: %s → %d contributors scanned", repo, len(contributors))

    # Finalize batch
    async with async_session_factory() as db:
        result = await db.execute(
            select(DiscoveryBatch).where(DiscoveryBatch.id == batch_id)
        )
        batch = result.scalar_one_or_none()
        if batch:
            batch.status = "completed"
            batch.completed_at = datetime.now(timezone.utc)
            batch.prospects_found = found
            batch.prospects_new = new
            await db.commit()

    logger.info("GitHub crawl complete: found=%d, new=%d, repos=%d", found, new, len(repos))
    return {"batch_id": batch_id, "prospects_found": found, "prospects_new": new, "repos_scanned": len(repos)}


def _infer_stack(repo: str) -> list[str]:
    """Infer software stack from repo name."""
    r = repo.lower()
    stack = []
    if "px4" in r:
        stack.extend(["PX4", "NuttX", "C++"])
    if "ardupilot" in r:
        stack.extend(["ArduPilot", "C++", "Python"])
    if "ros" in r or "navigation" in r:
        stack.extend(["ROS2", "C++", "Python"])
    if "gazebo" in r or "gz-" in r:
        stack.extend(["Gazebo", "C++"])
    if "airsim" in r:
        stack.extend(["AirSim", "C++", "Python"])
    if "stable-baselines" in r:
        stack.extend(["Python", "PyTorch"])
    return list(set(stack)) if stack else ["C++", "Python"]
