"""Tests for Research Analyzer Agent — paper/research relevance analysis."""
import pytest
from api.agents.research_analyzer import (
    _score_text_relevance,
    _analyze_papers,
    _analyze_research_areas,
    _generate_hook,
    _extract_technique,
)


# ─── Fixtures ──────────────────────────────────────────────────────────

class FakeProspect:
    def __init__(self, enrichment=None):
        self.enrichment = enrichment or {}


# ─── _score_text_relevance ─────────────────────────────────────────────

def test_drone_paper_scores_high():
    result = _score_text_relevance("FPGA-Accelerated Visual SLAM for Autonomous UAV Navigation")
    assert result["score"] >= 20
    assert not result["is_irrelevant"]
    assert "fpga" in result["keywords_found"]
    assert "slam" in [k.lower() for k in result["keywords_found"]] or "uav" in result["keywords_found"]


def test_sleep_paper_scores_zero():
    result = _score_text_relevance("SleepEEGNet: Automated sleep stage scoring with deep learning")
    assert result["score"] == 0 or result["is_irrelevant"]


def test_irrelevant_paper_flagged():
    result = _score_text_relevance(
        "Clinical genomic analysis of brain cancer using protein biomarkers and drug delivery"
    )
    assert result["is_irrelevant"]


def test_embedded_paper_scores_moderate():
    result = _score_text_relevance("Real-time embedded system design with STM32 microcontroller")
    assert result["score"] >= 10
    assert not result["is_irrelevant"]


def test_generic_ml_paper_low_score():
    result = _score_text_relevance("Attention is All You Need: Transformer Architecture for NLP")
    assert result["score"] < 10


def test_px4_paper_high_score():
    result = _score_text_relevance("PX4 Autopilot: A Micro Aerial Vehicle Platform for Research")
    assert result["score"] >= 20
    assert "px4" in result["keywords_found"]


# ─── _analyze_papers ───────────────────────────────────────────────────

def test_analyze_papers_picks_drone_paper():
    papers = [
        {"title": "SleepEEGNet: Automated sleep stage scoring"},
        {"title": "FPGA-Accelerated Object Detection for UAV Perception"},
        {"title": "Social Media Sentiment Analysis with BERT"},
    ]
    result = _analyze_papers(papers)
    assert result["best_paper"]["title"] == "FPGA-Accelerated Object Detection for UAV Perception"
    assert result["best_score"] >= 20
    assert result["analyzed"] == 3


def test_analyze_papers_string_format():
    papers = [
        "Deep Learning for Sleep Analysis",
        "Real-time Drone Navigation using Visual SLAM",
    ]
    result = _analyze_papers(papers)
    assert result["best_paper"] is not None
    assert "drone" in result["best_paper"]["title"].lower() or "slam" in result["best_paper"]["title"].lower()


def test_analyze_papers_empty():
    result = _analyze_papers([])
    assert result["best_paper"] is None
    assert result["best_score"] == 0


def test_analyze_papers_all_irrelevant():
    papers = [
        {"title": "Protein folding prediction using deep learning"},
        {"title": "Clinical trials for cancer drug delivery"},
    ]
    result = _analyze_papers(papers)
    # Both should be flagged irrelevant, so best_paper stays None
    assert result["best_score"] == 0


# ─── _analyze_research_areas ──────────────────────────────────────────

def test_analyze_areas_finds_relevant():
    areas = ["Machine Learning", "Autonomous UAV Navigation", "Computer Vision", "Sleep Analysis"]
    result = _analyze_research_areas(areas)
    assert "Autonomous UAV Navigation" in result["relevant_areas"]
    assert result["best_area"] == "Autonomous UAV Navigation"


def test_analyze_areas_embedded():
    areas = ["Digital Signal Processing", "FPGA Design", "Power Electronics"]
    result = _analyze_research_areas(areas)
    assert "FPGA Design" in result["relevant_areas"]


def test_analyze_areas_empty():
    result = _analyze_research_areas([])
    assert result["relevant_areas"] == []
    assert result["best_area"] is None


# ─── _generate_hook ────────────────────────────────────────────────────

def test_hook_strong_when_high_score_paper():
    paper_analysis = {
        "best_paper": {"title": "FPGA-Accelerated SLAM for Drone Navigation"},
        "best_score": 30,
        "best_analysis": {"best_capability_match": "fpga_design", "score": 30,
                          "keywords_found": ["fpga", "slam", "drone"], "is_irrelevant": False},
    }
    area_analysis = {
        "best_area": "Autonomous Systems",
        "relevant_areas": ["Autonomous Systems"],
        "relevance_score": 10,
    }
    hook = _generate_hook(paper_analysis, area_analysis, FakeProspect())
    assert hook["quality"] == "strong"
    assert hook["paper_title"] is not None
    assert "fpga" in hook["paper_title"].lower() or "slam" in hook["paper_title"].lower()


def test_hook_none_when_no_relevance():
    paper_analysis = {"best_paper": None, "best_score": 0, "best_analysis": None}
    area_analysis = {"best_area": None, "relevant_areas": [], "relevance_score": 0}
    hook = _generate_hook(paper_analysis, area_analysis, FakeProspect())
    assert hook["quality"] == "none"


def test_hook_good_when_area_relevant_but_paper_weak():
    paper_analysis = {
        "best_paper": {"title": "Some tangential paper"},
        "best_score": 3,
        "best_analysis": {"best_capability_match": None, "score": 3,
                          "keywords_found": [], "is_irrelevant": False},
    }
    area_analysis = {
        "best_area": "UAV Autonomous Navigation",
        "relevant_areas": ["UAV Autonomous Navigation"],
        "relevance_score": 15,
    }
    hook = _generate_hook(paper_analysis, area_analysis, FakeProspect())
    assert hook["quality"] == "good"
    assert "UAV Autonomous Navigation" in hook["technique_to_mention"]


# ─── _extract_technique ───────────────────────────────────────────────

def test_extract_technique_with_colon():
    result = _extract_technique("SLAM: Visual Simultaneous Localization and Mapping")
    assert len(result) <= 60
    assert "SLAM" in result


def test_extract_technique_no_separator():
    result = _extract_technique("Autonomous Drone Navigation in Dense Environments")
    assert len(result) <= 60


# ─── Integration-level: the full pipeline ──────────────────────────────

def test_full_pipeline_afghah_scenario():
    """
    THE EXACT BUG SCENARIO: Dr. Afghah has a sleep EEG paper.
    The old system would blindly reference it. The new system should NOT.
    """
    papers = [
        {"title": "SleepEEGNet: Automated sleep stage scoring with sequence-to-sequence deep learning approach"},
        {"title": "Cooperative UAV Search and Rescue in Post-Disaster Scenarios"},
        {"title": "Resource Allocation in Wireless Networks using Game Theory"},
    ]
    result = _analyze_papers(papers)
    # It should pick the UAV paper, NOT the sleep paper
    assert result["best_paper"] is not None
    assert "uav" in result["best_paper"]["title"].lower() or "drone" in result["best_paper"]["title"].lower()
    assert "sleep" not in result["best_paper"]["title"].lower()


def test_full_pipeline_no_drone_papers():
    """When NO paper is drone-relevant, we should get no best_paper."""
    papers = [
        {"title": "SleepEEGNet: Automated sleep stage scoring"},
        {"title": "Protein Structure Prediction with AlphaFold"},
    ]
    result = _analyze_papers(papers)
    assert result["best_score"] == 0
