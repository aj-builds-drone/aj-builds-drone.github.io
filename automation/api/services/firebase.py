"""
AJ Builds Drone — Firebase RTDB bridge service.

Shares the same Firebase project as AjayaDesign (ajayadesign-6d739).
All drone data lives under the 'drone/' prefix in RTDB.

Requires firebase-admin SDK and a service account key.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import firebase_admin
    from firebase_admin import credentials, db as firebase_db
    _HAS_FIREBASE = True
except ImportError:
    _HAS_FIREBASE = False
    logger.warning("firebase-admin not installed — Firebase bridge disabled")

_initialized = False
_PREFIX = "drone"  # All RTDB paths prefixed with drone/


def init_firebase(cred_path: str = "", db_url: str = "") -> bool:
    global _initialized
    if not _HAS_FIREBASE:
        logger.warning("firebase-admin not installed — skipping init")
        return False
    if _initialized:
        return True
    if not cred_path:
        logger.warning("FIREBASE_CRED_PATH not set — Firebase bridge disabled")
        return False
    try:
        # Check if already initialized by ajayadesign (shared app)
        try:
            firebase_admin.get_app()
            _initialized = True
            logger.info("Firebase Admin SDK already initialized (shared app)")
            return True
        except ValueError:
            pass
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {"databaseURL": db_url})
        _initialized = True
        logger.info("Firebase Admin SDK initialized for drone pipeline")
        return True
    except Exception as e:
        logger.error(f"Firebase init failed: {e}")
        return False


def is_initialized() -> bool:
    return _initialized


def _ref(path: str):
    """Get a Firebase RTDB reference under the drone/ namespace."""
    return firebase_db.reference(f"{_PREFIX}/{path}")


# ── Prospect sync ──

def sync_prospect_to_firebase(prospect_data: dict) -> bool:
    if not _initialized:
        return False
    pid = prospect_data.get("id", "")
    if not pid:
        return False
    try:
        _ref(f"prospects/{pid}").update({
            "name": prospect_data.get("name", ""),
            "email": prospect_data.get("email", ""),
            "organization": prospect_data.get("organization", ""),
            "department": prospect_data.get("department", ""),
            "title": prospect_data.get("title", ""),
            "lab_name": prospect_data.get("lab_name", ""),
            "h_index": prospect_data.get("h_index"),
            "priority_score": prospect_data.get("priority_score"),
            "tier": prospect_data.get("tier", ""),
            "status": prospect_data.get("status", ""),
            "source": prospect_data.get("source", ""),
            "updated_at": {".sv": "timestamp"},
        })
        return True
    except Exception as e:
        logger.error(f"Firebase sync prospect failed: {e}")
        return False


# ── Contract sync ──

def sync_contract_to_firebase(contract_data: dict) -> bool:
    if not _initialized:
        return False
    short_id = contract_data.get("short_id", "")
    if not short_id:
        return False
    try:
        raw_clauses = contract_data.get("clauses", [])
        fb_clauses = [
            {"title": c.get("title", ""), "body": c.get("body", ""),
             "category": c.get("category", "custom"), "enabled": c.get("enabled", True)}
            for c in (raw_clauses if isinstance(raw_clauses, list) else [])
        ]
        _ref(f"contracts/{short_id}").update({
            "client_name": contract_data.get("client_name", ""),
            "client_email": contract_data.get("client_email", ""),
            "project_name": contract_data.get("project_name", ""),
            "project_description": contract_data.get("project_description", ""),
            "total_amount": contract_data.get("total_amount", 0),
            "deposit_amount": contract_data.get("deposit_amount", 0),
            "payment_method": contract_data.get("payment_method", ""),
            "payment_terms": contract_data.get("payment_terms", ""),
            "start_date": contract_data.get("start_date"),
            "estimated_completion_date": contract_data.get("estimated_completion_date"),
            "clauses": fb_clauses,
            "custom_notes": contract_data.get("custom_notes", ""),
            "status": contract_data.get("status", "draft"),
            "signed_at": contract_data.get("signed_at"),
            "signer_name": contract_data.get("signer_name"),
            "signature_data": contract_data.get("signature_data"),
            "signer_ip": contract_data.get("signer_ip"),
            "sign_token": contract_data.get("sign_token"),
            "sent_at": contract_data.get("sent_at"),
            "updated_at": {".sv": "timestamp"},
        })
        logger.info(f"Firebase drone/contracts/{short_id} synced")
        return True
    except Exception as e:
        logger.error(f"Firebase sync_contract failed: {e}")
        return False


def delete_contract_from_firebase(short_id: str) -> bool:
    if not _initialized:
        return False
    try:
        _ref(f"contracts/{short_id}").delete()
        return True
    except Exception as e:
        logger.error(f"Firebase delete contract failed: {e}")
        return False


def publish_contract_for_signing(sign_token: str, contract_data: dict) -> bool:
    if not _initialized:
        return False
    try:
        _ref(f"signing/{sign_token}").set({
            "short_id": contract_data.get("short_id", ""),
            "client_name": contract_data.get("client_name", ""),
            "project_name": contract_data.get("project_name", ""),
            "project_description": contract_data.get("project_description", ""),
            "total_amount": contract_data.get("total_amount", 0),
            "deposit_amount": contract_data.get("deposit_amount", 0),
            "payment_method": contract_data.get("payment_method", ""),
            "payment_terms": contract_data.get("payment_terms", ""),
            "start_date": contract_data.get("start_date"),
            "estimated_completion_date": contract_data.get("estimated_completion_date"),
            "clauses": contract_data.get("clauses", []),
            "custom_notes": contract_data.get("custom_notes", ""),
            "provider_name": "AjayaDesign",
            "provider_email": "ajayadesign@gmail.com",
            "provider_address": "13721 Andrew Abernathy Pass, Manor, TX 78653",
            "status": "sent",
            "signed_at": None,
            "signer_name": None,
            "signature_data": None,
            "published_at": {".sv": "timestamp"},
        })
        logger.info(f"Firebase drone/signing/{sign_token} published")
        return True
    except Exception as e:
        logger.error(f"Firebase publish_contract_for_signing failed: {e}")
        return False


def get_pending_signatures() -> list[dict]:
    if not _initialized:
        return []
    try:
        ref = _ref("signing")
        snapshot = ref.order_by_child("status").equal_to("signed").get()
        if not snapshot:
            return []
        return [{"sign_token": k, **v} for k, v in snapshot.items()]
    except Exception as e:
        logger.error(f"Firebase get_pending_signatures failed: {e}")
        return []


def mark_signature_processed(sign_token: str) -> bool:
    if not _initialized:
        return False
    try:
        _ref(f"signing/{sign_token}").update({
            "status": "processed",
            "processed_at": {".sv": "timestamp"},
        })
        return True
    except Exception as e:
        logger.error(f"Firebase mark_signature_processed failed: {e}")
        return False


# ── Invoice sync ──

def sync_invoice_to_firebase(invoice_data: dict) -> bool:
    if not _initialized:
        return False
    inv_num = invoice_data.get("invoice_number", "")
    if not inv_num:
        return False
    try:
        raw_plan = invoice_data.get("payment_plan", [])
        fb_plan = [
            {"id": p.get("id", ""), "due_date": p.get("due_date", ""),
             "amount": p.get("amount", 0), "status": p.get("status", "pending"),
             "paid_at": p.get("paid_at")}
            for p in (raw_plan if isinstance(raw_plan, list) else [])
        ]
        _ref(f"invoices/{inv_num}").update({
            "client_name": invoice_data.get("client_name", ""),
            "client_email": invoice_data.get("client_email", ""),
            "total_amount": invoice_data.get("total_amount", 0),
            "subtotal": invoice_data.get("subtotal", 0),
            "tax_amount": invoice_data.get("tax_amount", 0),
            "amount_paid": invoice_data.get("amount_paid", 0),
            "payment_status": invoice_data.get("payment_status", "unpaid"),
            "payment_method": invoice_data.get("payment_method", ""),
            "status": invoice_data.get("status", "draft"),
            "due_date": invoice_data.get("due_date"),
            "paid_at": invoice_data.get("paid_at"),
            "items": invoice_data.get("items", []),
            "notes": invoice_data.get("notes", ""),
            "payment_plan": fb_plan,
            "payment_plan_enabled": invoice_data.get("payment_plan_enabled", "false"),
            "updated_at": {".sv": "timestamp"},
        })
        logger.info(f"Firebase drone/invoices/{inv_num} synced")
        return True
    except Exception as e:
        logger.error(f"Firebase sync_invoice failed: {e}")
        return False


def delete_invoice_from_firebase(invoice_number: str) -> bool:
    if not _initialized:
        return False
    try:
        _ref(f"invoices/{invoice_number}").delete()
        return True
    except Exception as e:
        logger.error(f"Firebase delete invoice failed: {e}")
        return False


# ── Email queue (human-in-loop approval) ──

def queue_email_for_approval(email_data: dict) -> bool:
    """Push a draft email to Firebase for human review/approval."""
    if not _initialized:
        return False
    email_id = email_data.get("id", "")
    if not email_id:
        return False
    try:
        _ref(f"email_queue/{email_id}").set({
            "prospect_id": email_data.get("prospect_id", ""),
            "prospect_name": email_data.get("prospect_name", ""),
            "prospect_email": email_data.get("to", ""),
            "subject": email_data.get("subject", ""),
            "body_preview": email_data.get("body_preview", ""),
            "template": email_data.get("template", ""),
            "step": email_data.get("step", 1),
            "status": "pending_approval",
            "created_at": {".sv": "timestamp"},
        })
        logger.info(f"Email {email_id} queued for approval")
        return True
    except Exception as e:
        logger.error(f"Firebase queue_email_for_approval failed: {e}")
        return False


def get_approved_emails() -> list[dict]:
    """Get emails that have been approved by the human."""
    if not _initialized:
        return []
    try:
        ref = _ref("email_queue")
        snapshot = ref.order_by_child("status").equal_to("approved").get()
        if not snapshot:
            return []
        return [{"email_id": k, **v} for k, v in snapshot.items()]
    except Exception as e:
        logger.error(f"Firebase get_approved_emails failed: {e}")
        return []


def mark_email_sent(email_id: str) -> bool:
    if not _initialized:
        return False
    try:
        _ref(f"email_queue/{email_id}").update({
            "status": "sent",
            "sent_at": {".sv": "timestamp"},
        })
        return True
    except Exception as e:
        logger.error(f"Firebase mark_email_sent failed: {e}")
        return False


def mark_email_rejected(email_id: str, reason: str = "") -> bool:
    if not _initialized:
        return False
    try:
        _ref(f"email_queue/{email_id}").update({
            "status": "rejected",
            "rejection_reason": reason,
            "rejected_at": {".sv": "timestamp"},
        })
        return True
    except Exception as e:
        logger.error(f"Firebase mark_email_rejected failed: {e}")
        return False


# ── Activity log sync ──

def sync_activity_to_firebase(activity_data: dict) -> bool:
    if not _initialized:
        return False
    try:
        entry_id = activity_data.get("id", "unknown")
        _ref(f"activity_logs/{entry_id}").set(activity_data)
        return True
    except Exception as e:
        logger.error(f"Firebase sync_activity failed: {e}")
        return False
