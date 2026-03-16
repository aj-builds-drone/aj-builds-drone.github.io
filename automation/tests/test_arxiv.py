"""
AJ Builds Drone — arXiv crawler tests.
"""

import xml.etree.ElementTree as ET

from api.services.arxiv_crawler import (
    _extract_research_areas,
    _extract_university,
    _extract_department,
    _parse_entry,
    NS,
)


# Minimal arXiv Atom entry for testing
SAMPLE_ENTRY_XML = """
<entry xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <id>http://arxiv.org/abs/2401.12345v1</id>
  <title>Autonomous Drone Navigation using Visual SLAM and FPGA Acceleration</title>
  <summary>We present a novel approach to UAV navigation combining visual SLAM
  with FPGA-based real-time processing for obstacle avoidance in GPS-denied environments.</summary>
  <published>2024-01-15T00:00:00Z</published>
  <author>
    <name>Jane Smith</name>
    <arxiv:affiliation>Department of Aerospace Engineering, Massachusetts Institute of Technology</arxiv:affiliation>
  </author>
  <author>
    <name>Bob Chen</name>
    <arxiv:affiliation>School of Computer Science, Stanford University</arxiv:affiliation>
  </author>
  <author>
    <name>Alice Zhang</name>
  </author>
</entry>
"""

IRRELEVANT_ENTRY_XML = """
<entry xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <id>http://arxiv.org/abs/2401.99999v1</id>
  <title>Quantum Computing for Protein Folding Simulations</title>
  <summary>We explore quantum algorithms for protein structure prediction using variational methods.</summary>
  <published>2024-02-01T00:00:00Z</published>
  <author>
    <name>Unrelated Researcher</name>
    <arxiv:affiliation>Department of Physics, Harvard University</arxiv:affiliation>
  </author>
</entry>
"""


class TestArxivParser:

    def test_extract_research_areas_slam(self):
        areas = _extract_research_areas("Visual SLAM for drones", "obstacle avoidance")
        assert "SLAM" in areas
        assert "Autonomous Navigation" in areas

    def test_extract_research_areas_fpga(self):
        areas = _extract_research_areas("FPGA acceleration", "real-time processing for edge computing")
        assert "FPGA" in areas
        assert "Edge Computing" in areas

    def test_extract_research_areas_empty(self):
        areas = _extract_research_areas("", "")
        assert areas == []

    def test_extract_university(self):
        assert _extract_university("Department of CS, Stanford University") == "Stanford University"
        assert _extract_university("MIT") is not None
        assert _extract_university(None) is None

    def test_extract_department(self):
        assert _extract_department("Department of Aerospace Engineering, MIT") == "Department of Aerospace Engineering"
        assert _extract_department(None) is None

    def test_parse_drone_entry(self):
        entry = ET.fromstring(SAMPLE_ENTRY_XML)
        prospects = _parse_entry(entry)
        assert len(prospects) >= 2  # Jane + Bob (Alice has no affiliation, may be skipped later)
        names = [p["name"] for p in prospects]
        assert "Jane Smith" in names
        assert "Bob Chen" in names
        # Check research areas
        for p in prospects:
            assert len(p["research_areas"]) > 0
            assert p["recent_paper"]["venue"] == "arXiv"
            assert "2401.12345" in p["source_url"]

    def test_parse_irrelevant_entry(self):
        entry = ET.fromstring(IRRELEVANT_ENTRY_XML)
        prospects = _parse_entry(entry)
        assert len(prospects) == 0  # Quantum computing paper should be filtered out

    def test_organization_extraction(self):
        entry = ET.fromstring(SAMPLE_ENTRY_XML)
        prospects = _parse_entry(entry)
        orgs = {p["name"]: p["organization"] for p in prospects}
        assert "Massachusetts Institute of Technology" in orgs["Jane Smith"]
        assert "Stanford University" in orgs["Bob Chen"]
