"""
De-duplication Engine — Merge duplicate prospects from multiple sources.

When crawlers discover the same professor from different sources (Scholar,
NSF, faculty page, arXiv), this engine merges them into the richest
single record.

Matching strategies (ordered by confidence):
1. Exact email match (highest confidence)
2. Scholar URL match
3. Name + organization fuzzy match

Merge strategy: keep the record with the most data, augment with fields
from duplicates, then soft-delete the duplicated records.
"""

import logging
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import async_session_factory
from api.models.prospect import DroneProspect

logger = logging.getLogger("drone.dedup")


def _normalize_name(name: str) -> str:
    """Normalize name for comparison: lowercase, strip titles."""
    if not name:
        return ""
    n = name.lower().strip()
    for prefix in ("dr.", "dr ", "prof.", "prof ", "professor "):
        if n.startswith(prefix):
            n = n[len(prefix):].strip()
    return n


def _normalize_org(org: str) -> str:
    """Normalize organization name for comparison."""
    if not org:
        return ""
    o = org.lower().strip()
    # Remove common suffixes/prefixes
    for noise in ("the ", "university of ", "of "):
        o = o.replace(noise, "")
    return o.replace(" ", "")


def _pick_best(a, b):
    """Pick the non-None, non-empty value, preferring a."""
    if a is not None and a != "" and a != [] and a != 0:
        return a
    return b


def _merge_lists(a: list, b: list) -> list:
    """Merge two lists, dedup by string representation."""
    seen = set()
    result = []
    for item in (a or []) + (b or []):
        key = str(item)
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result


def _richness_score(p: DroneProspect) -> int:
    """Score how complete a prospect record is. Higher = richer data."""
    score = 0
    if p.email:
        score += 10
    if p.h_index and p.h_index > 0:
        score += 5
    if p.total_grant_funding and p.total_grant_funding > 0:
        score += 8
    if p.research_areas:
        score += len(p.research_areas)
    if p.recent_papers:
        score += len(p.recent_papers) * 2
    if p.active_grants:
        score += len(p.active_grants) * 3
    if p.scholar_url:
        score += 3
    if p.lab_name:
        score += 2
    if p.department:
        score += 1
    if p.phone:
        score += 1
    if p.linkedin_url:
        score += 2
    return score


async def _merge_pair(keep: DroneProspect, drop: DroneProspect, db: AsyncSession) -> None:
    """Merge data from `drop` into `keep`, then mark `drop` as merged."""
    # Scalar fields: fill gaps in keep
    keep.email = _pick_best(keep.email, drop.email)
    keep.title = _pick_best(keep.title, drop.title)
    keep.department = _pick_best(keep.department, drop.department)
    keep.phone = _pick_best(keep.phone, drop.phone)
    keep.linkedin_url = _pick_best(keep.linkedin_url, drop.linkedin_url)
    keep.scholar_url = _pick_best(keep.scholar_url, drop.scholar_url)
    keep.personal_site = _pick_best(keep.personal_site, drop.personal_site)
    keep.lab_url = _pick_best(keep.lab_url, drop.lab_url)
    keep.lab_name = _pick_best(keep.lab_name, drop.lab_name)
    keep.lab_description = _pick_best(keep.lab_description, drop.lab_description)
    keep.h_index = _pick_best(keep.h_index, drop.h_index)
    keep.total_citations = _pick_best(keep.total_citations, drop.total_citations)
    keep.publication_rate = _pick_best(keep.publication_rate, drop.publication_rate)
    keep.lab_students_count = _pick_best(keep.lab_students_count, drop.lab_students_count)
    keep.total_grant_funding = _pick_best(keep.total_grant_funding, drop.total_grant_funding)
    keep.simulation_setup = _pick_best(keep.simulation_setup, drop.simulation_setup)
    keep.flight_controller = _pick_best(keep.flight_controller, drop.flight_controller)
    keep.flight_controller_version = _pick_best(keep.flight_controller_version, drop.flight_controller_version)
    keep.faa_part107 = _pick_best(keep.faa_part107, drop.faa_part107)

    # Boolean fields: True wins
    if drop.has_drone_lab:
        keep.has_drone_lab = True
    if drop.has_custom_hardware:
        keep.has_custom_hardware = True
    if drop.has_fpga:
        keep.has_fpga = True
    if drop.flight_testing_capability:
        keep.flight_testing_capability = True

    # List fields: merge
    keep.research_areas = _merge_lists(keep.research_areas, drop.research_areas)
    keep.recent_papers = _merge_lists(keep.recent_papers, drop.recent_papers)
    keep.active_grants = _merge_lists(keep.active_grants, drop.active_grants)
    keep.hardware_platforms = _merge_lists(keep.hardware_platforms, drop.hardware_platforms)
    keep.software_stack = _merge_lists(keep.software_stack, drop.software_stack)
    keep.sensor_types = _merge_lists(keep.sensor_types, drop.sensor_types)
    keep.grant_agencies = _merge_lists(keep.grant_agencies, drop.grant_agencies)
    keep.tags = _merge_lists(keep.tags, drop.tags)
    keep.certifications = _merge_lists(keep.certifications, drop.certifications)

    # Track sources
    note = f"Merged from {drop.source} ({drop.source_url or 'no-url'}) on {datetime.now(timezone.utc).isoformat()}"
    keep.notes = f"{keep.notes or ''}\n{note}".strip()

    keep.updated_at = datetime.now(timezone.utc)

    # Mark the duplicate as merged (soft delete via status)
    drop.status = "merged"
    drop.notes = f"{drop.notes or ''}\nMerged into {keep.id}".strip()


async def run_deduplication() -> dict:
    """
    Main de-duplication pass across all active prospects.

    Returns: {"checked": int, "merged": int}
    """
    async with async_session_factory() as db:
        # Get all non-merged prospects
        result = await db.execute(
            select(DroneProspect)
            .where(DroneProspect.status != "merged")
            .order_by(DroneProspect.created_at)
        )
        prospects = list(result.scalars().all())

        checked = 0
        merged = 0

        # Strategy 1: Email dedup (highest confidence)
        email_groups: dict[str, list[DroneProspect]] = {}
        for p in prospects:
            if p.email:
                key = p.email.lower().strip()
                email_groups.setdefault(key, []).append(p)

        for email, group in email_groups.items():
            if len(group) < 2:
                continue
            # Sort by richness: keep the richest record
            group.sort(key=_richness_score, reverse=True)
            keep = group[0]
            for dup in group[1:]:
                await _merge_pair(keep, dup, db)
                merged += 1
                checked += 1
                logger.info("Merged (email): %s ← %s [%s]", keep.name, dup.name, dup.source)

        # Strategy 2: Scholar URL dedup
        scholar_groups: dict[str, list[DroneProspect]] = {}
        active = [p for p in prospects if p.status != "merged"]
        for p in active:
            if p.scholar_url:
                key = p.scholar_url.lower().strip()
                scholar_groups.setdefault(key, []).append(p)

        for url, group in scholar_groups.items():
            if len(group) < 2:
                continue
            group.sort(key=_richness_score, reverse=True)
            keep = group[0]
            for dup in group[1:]:
                await _merge_pair(keep, dup, db)
                merged += 1
                checked += 1
                logger.info("Merged (scholar_url): %s ← %s", keep.name, dup.name)

        # Strategy 3: Name + Organization fuzzy match
        active = [p for p in prospects if p.status != "merged"]
        name_org_groups: dict[str, list[DroneProspect]] = {}
        for p in active:
            key = f"{_normalize_name(p.name)}@{_normalize_org(p.organization)}"
            if key == "@":
                continue
            name_org_groups.setdefault(key, []).append(p)

        for key, group in name_org_groups.items():
            if len(group) < 2:
                continue
            group.sort(key=_richness_score, reverse=True)
            keep = group[0]
            for dup in group[1:]:
                await _merge_pair(keep, dup, db)
                merged += 1
                checked += 1
                logger.info("Merged (name+org): %s ← %s", keep.name, dup.name)

        await db.commit()

        result = {"checked": checked, "merged": merged}
        logger.info("De-duplication complete: %s", result)
        return result
