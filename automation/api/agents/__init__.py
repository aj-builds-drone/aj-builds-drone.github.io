"""
AJ Builds Drone — Agent package.

All old AjayaDesign agents replaced by the drone agent scheduler.
"""

from .scheduler import scheduler, register_all_agents

__all__ = [
    # Phase 1
    "execute_scout_cycle",
    "get_scout_stats",
    "execute_audit_cycle",
    "get_audit_stats",
    "execute_copywriter_cycle",
    "get_copywriter_stats",
    # Phase 2
    "execute_enrichment_cycle",
    "get_enrichment_stats",
    "execute_scoring_cycle",
    "get_scoring_stats",
    "execute_email_qa_cycle",
    "get_email_qa_stats",
    "execute_monitor_cycle",
    "get_pipeline_monitor_stats",
    # Phase 3
    "execute_sales_qualification_cycle",
    "get_sales_qualification_stats",
    "execute_proposal_generator_cycle",
    "get_proposal_generator_stats",
    "execute_contract_cycle",
    "get_contract_stats",
    "execute_onboarding_cycle",
    "get_onboarding_stats",
]
