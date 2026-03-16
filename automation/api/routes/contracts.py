"""
AJ Builds Drone — Contract & Invoice API routes.

Ported from AjayaDesign with drone-specific adaptations.
Sender identity: AjayaDesign (parent business entity).
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func as sqlfunc
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.contract import Contract, Invoice
from api.schemas.contract import (
    ContractCreateRequest, ContractUpdateRequest, ContractResponse,
    ContractListResponse, ContractSignRequest,
    InvoiceCreateRequest, InvoiceUpdateRequest, InvoiceResponse,
    InvoiceListResponse,
    SendEmailRequest, SendEmailResponse,
    ClauseItem, InvoiceLineItem, PaymentPlanInstallment,
    RecordPaymentRequest,
)
from api.services.email_service import (
    send_email, build_contract_email, build_invoice_email,
    build_signed_notification_email, build_payment_reminder_email,
)
from api.services.firebase import (
    sync_contract_to_firebase, delete_contract_from_firebase,
    sync_invoice_to_firebase, delete_invoice_from_firebase,
    publish_contract_for_signing, get_pending_signatures,
    mark_signature_processed,
)
from api.routes.activity import log_activity

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/contracts", tags=["contracts"])
invoice_router = APIRouter(prefix="/invoices", tags=["invoices"])
email_router = APIRouter(prefix="/email", tags=["email"])

PROVIDER_NAME = "AjayaDesign"
PROVIDER_EMAIL = "ajayadesign@gmail.com"
PROVIDER_ADDRESS = "13721 Andrew Abernathy Pass, Manor, TX 78653"


def _short_id() -> str:
    return uuid.uuid4().hex[:8]


def _sync_contract_fb(c: Contract) -> None:
    try:
        sync_contract_to_firebase({
            "short_id": c.short_id,
            "client_name": c.client_name,
            "client_email": c.client_email,
            "client_phone": c.client_phone or "",
            "client_address": c.client_address or "",
            "project_name": c.project_name,
            "project_description": c.project_description or "",
            "total_amount": float(c.total_amount or 0),
            "deposit_amount": float(c.deposit_amount or 0),
            "payment_method": c.payment_method or "",
            "payment_terms": c.payment_terms or "",
            "start_date": c.start_date.isoformat() if c.start_date else None,
            "estimated_completion_date": c.estimated_completion_date.isoformat() if c.estimated_completion_date else None,
            "clauses": c.clauses or [],
            "custom_notes": c.custom_notes or "",
            "status": c.status or "draft",
            "signed_at": c.signed_at.isoformat() if c.signed_at else None,
            "signer_name": c.signer_name,
            "signature_data": c.signature_data,
            "signer_ip": c.signer_ip or "",
            "sign_token": c.sign_token or "",
            "sent_at": c.sent_at.isoformat() if c.sent_at else None,
        })
    except Exception as e:
        logger.warning(f"Firebase contract sync failed: {e}")


def _sync_invoice_fb(inv: Invoice) -> None:
    try:
        plan = inv.payment_plan or []
        sync_invoice_to_firebase({
            "invoice_number": inv.invoice_number,
            "client_name": inv.client_name,
            "client_email": inv.client_email,
            "total_amount": float(inv.total_amount or 0),
            "subtotal": float(inv.subtotal or 0),
            "tax_amount": float(inv.tax_amount or 0),
            "amount_paid": float(inv.amount_paid or 0),
            "payment_status": inv.payment_status or "unpaid",
            "payment_method": inv.payment_method or "",
            "status": inv.status or "draft",
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
            "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
            "items": inv.items or [],
            "notes": inv.notes or "",
            "payment_plan": plan,
            "payment_plan_enabled": inv.payment_plan_enabled or "false",
        })
    except Exception as e:
        logger.warning(f"Firebase invoice sync failed: {e}")


def _contract_to_response(c: Contract) -> dict:
    return {
        "id": str(c.id),
        "short_id": c.short_id,
        "build_id": str(c.build_id) if c.build_id else None,
        "client_name": c.client_name,
        "client_email": c.client_email,
        "client_address": c.client_address or "",
        "client_phone": c.client_phone or "",
        "project_name": c.project_name,
        "project_description": c.project_description or "",
        "total_amount": float(c.total_amount or 0),
        "deposit_amount": float(c.deposit_amount or 0),
        "payment_method": c.payment_method or "",
        "payment_terms": c.payment_terms or "",
        "start_date": c.start_date.isoformat() if c.start_date else None,
        "estimated_completion_date": c.estimated_completion_date.isoformat() if c.estimated_completion_date else None,
        "clauses": c.clauses or [],
        "custom_notes": c.custom_notes or "",
        "provider_name": PROVIDER_NAME,
        "provider_email": PROVIDER_EMAIL,
        "provider_address": PROVIDER_ADDRESS,
        "status": c.status or "draft",
        "sign_token": c.sign_token or "",
        "signed_at": c.signed_at.isoformat() if c.signed_at else None,
        "signer_name": c.signer_name,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        "sent_at": c.sent_at.isoformat() if c.sent_at else None,
        "invoices": [],
    }


def _invoice_to_response(inv: Invoice) -> dict:
    return {
        "id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "contract_id": str(inv.contract_id) if inv.contract_id else None,
        "build_id": str(inv.build_id) if inv.build_id else None,
        "client_name": inv.client_name,
        "client_email": inv.client_email,
        "items": inv.items or [],
        "subtotal": float(inv.subtotal or 0),
        "tax_rate": float(inv.tax_rate or 0),
        "tax_amount": float(inv.tax_amount or 0),
        "total_amount": float(inv.total_amount or 0),
        "amount_paid": float(inv.amount_paid or 0),
        "payment_method": inv.payment_method or "",
        "payment_status": inv.payment_status or "unpaid",
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
        "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
        "provider_name": PROVIDER_NAME,
        "provider_email": PROVIDER_EMAIL,
        "provider_address": PROVIDER_ADDRESS,
        "notes": inv.notes or "",
        "status": inv.status or "draft",
        "payment_plan": inv.payment_plan or [],
        "payment_plan_enabled": inv.payment_plan_enabled or "false",
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
        "sent_at": inv.sent_at.isoformat() if inv.sent_at else None,
    }


async def _next_invoice_number(db: AsyncSession) -> str:
    result = await db.execute(select(sqlfunc.count(Invoice.id)))
    count = result.scalar() or 0
    return f"DRONE-INV-{count + 1:03d}"


# ── Contract CRUD ──


@router.get("", response_model=ContractListResponse)
async def list_contracts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contract).order_by(Contract.created_at.desc()))
    contracts = result.scalars().all()
    return {"contracts": [_contract_to_response(c) for c in contracts], "total": len(contracts)}


@router.post("", status_code=201)
async def create_contract(req: ContractCreateRequest, db: AsyncSession = Depends(get_db)):
    c = Contract(
        id=uuid.uuid4(),
        short_id=_short_id(),
        build_id=uuid.UUID(req.build_id) if req.build_id else None,
        client_name=req.client_name,
        client_email=req.client_email,
        client_address=req.client_address,
        client_phone=req.client_phone,
        project_name=req.project_name,
        project_description=req.project_description,
        total_amount=req.total_amount,
        deposit_amount=req.deposit_amount,
        payment_method=req.payment_method,
        payment_terms=req.payment_terms,
        start_date=req.start_date,
        estimated_completion_date=req.estimated_completion_date,
        clauses=[cl.model_dump() for cl in req.clauses],
        custom_notes=req.custom_notes,
        status="draft",
        sign_token=uuid.uuid4().hex,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    _sync_contract_fb(c)
    await log_activity("contract", c.short_id, "created", f"Contract created for {c.client_name}", "📝", db=db)
    await db.commit()
    return _contract_to_response(c)


@router.get("/{contract_id}")
async def get_contract(contract_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Contract).where((Contract.short_id == contract_id) | (Contract.id == contract_id))
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Contract not found")
    return _contract_to_response(c)


@router.patch("/{contract_id}")
async def update_contract(contract_id: str, req: ContractUpdateRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Contract).where((Contract.short_id == contract_id) | (Contract.id == contract_id))
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Contract not found")
    if c.status in ("signed", "completed"):
        raise HTTPException(403, "Cannot modify a signed/completed contract")
    updates = req.model_dump(exclude_unset=True)
    if "clauses" in updates and updates["clauses"] is not None:
        updates["clauses"] = [cl.model_dump() if hasattr(cl, "model_dump") else cl for cl in updates["clauses"]]
    for k, v in updates.items():
        setattr(c, k, v)
    c.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(c)
    _sync_contract_fb(c)
    return _contract_to_response(c)


@router.delete("/{contract_id}")
async def delete_contract(contract_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Contract).where((Contract.short_id == contract_id) | (Contract.id == contract_id))
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Contract not found")
    if c.status in ("signed", "completed"):
        raise HTTPException(403, "Cannot delete a signed/completed contract")
    short_id = c.short_id
    await db.delete(c)
    await db.commit()
    delete_contract_from_firebase(short_id)
    return {"success": True}


# ── Contract signing (public endpoints) ──


@router.get("/sign/{sign_token}")
async def get_contract_for_signing(sign_token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contract).where(Contract.sign_token == sign_token))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Contract not found")
    resp = _contract_to_response(c)
    if c.status == "sent":
        c.status = "viewed"
        c.updated_at = datetime.now(timezone.utc)
        await db.commit()
        _sync_contract_fb(c)
    return resp


@router.post("/sign/{sign_token}")
async def sign_contract(sign_token: str, req: ContractSignRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contract).where(Contract.sign_token == sign_token))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Contract not found")
    if c.status in ("signed", "completed"):
        raise HTTPException(400, "Contract already signed")
    c.status = "signed"
    c.signed_at = datetime.now(timezone.utc)
    c.signer_name = req.signer_name
    c.signature_data = req.signature_data
    c.signer_ip = request.client.host if request.client else ""
    c.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(c)
    _sync_contract_fb(c)
    await log_activity("contract", c.short_id, "signed", f"Signed by {req.signer_name}", "✍️", db=db)
    await db.commit()
    # Send notification to admin
    try:
        subj, body = build_signed_notification_email(c.client_name, c.project_name, c.short_id)
        await send_email(PROVIDER_EMAIL, subj, body)
    except Exception as e:
        logger.warning(f"Failed to send signed notification: {e}")
    return {"success": True, "message": "Contract signed successfully"}


# ── Send contract email ──


@router.post("/{contract_id}/send-email")
async def send_contract_email(contract_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Contract).where((Contract.short_id == contract_id) | (Contract.id == contract_id))
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Contract not found")
    sign_url = f"https://drone.ajbuilds.com/drone-admin/sign.html?token={c.sign_token}"
    subj, body = build_contract_email(c.client_name, c.project_name, sign_url, float(c.total_amount or 0))
    success = await send_email(c.client_email, subj, body)
    if success:
        c.status = "sent"
        c.sent_at = datetime.now(timezone.utc)
        c.updated_at = datetime.now(timezone.utc)
        await db.commit()
        _sync_contract_fb(c)
        publish_contract_for_signing(c.sign_token, _contract_to_response(c))
        await log_activity("contract", c.short_id, "sent", f"Contract emailed to {c.client_email}", "📧", db=db)
        await db.commit()
        return {"success": True, "message": f"Contract sent to {c.client_email}"}
    raise HTTPException(500, "Failed to send email")


# ── Invoice CRUD ──


@invoice_router.get("", response_model=InvoiceListResponse)
async def list_invoices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Invoice).order_by(Invoice.created_at.desc()))
    invoices = result.scalars().all()
    return {"invoices": [_invoice_to_response(i) for i in invoices], "total": len(invoices)}


@invoice_router.post("", status_code=201)
async def create_invoice(req: InvoiceCreateRequest, db: AsyncSession = Depends(get_db)):
    inv = Invoice(
        id=str(uuid.uuid4()),
        invoice_number=await _next_invoice_number(db),
        contract_id=req.contract_id or None,
        build_id=req.build_id or None,
        client_name=req.client_name,
        client_email=req.client_email,
        items=[item.model_dump(mode="json") for item in req.items],
        subtotal=req.subtotal,
        tax_rate=req.tax_rate,
        tax_amount=req.tax_amount,
        total_amount=req.total_amount,
        amount_paid=req.amount_paid,
        payment_method=req.payment_method,
        payment_status=req.payment_status,
        due_date=req.due_date,
        notes=req.notes,
        status="draft",
        payment_plan=[p.model_dump() for p in req.payment_plan],
        payment_plan_enabled=req.payment_plan_enabled,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    _sync_invoice_fb(inv)
    await log_activity("invoice", inv.invoice_number, "created", f"Invoice created for {inv.client_name}", "🧾", db=db)
    await db.commit()
    return _invoice_to_response(inv)


@invoice_router.get("/{invoice_id}")
async def get_invoice(invoice_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Invoice).where((Invoice.invoice_number == invoice_id) | (Invoice.id == invoice_id))
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return _invoice_to_response(inv)


@invoice_router.patch("/{invoice_id}")
async def update_invoice(invoice_id: str, req: InvoiceUpdateRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Invoice).where((Invoice.invoice_number == invoice_id) | (Invoice.id == invoice_id))
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    updates = req.model_dump(exclude_unset=True)
    if "items" in updates and updates["items"] is not None:
        updates["items"] = [i.model_dump() if hasattr(i, "model_dump") else i for i in updates["items"]]
    if "payment_plan" in updates and updates["payment_plan"] is not None:
        updates["payment_plan"] = [p.model_dump() if hasattr(p, "model_dump") else p for p in updates["payment_plan"]]
    for k, v in updates.items():
        setattr(inv, k, v)
    inv.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(inv)
    _sync_invoice_fb(inv)
    return _invoice_to_response(inv)


@invoice_router.delete("/{invoice_id}")
async def delete_invoice(invoice_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Invoice).where((Invoice.invoice_number == invoice_id) | (Invoice.id == invoice_id))
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    inv_num = inv.invoice_number
    await db.delete(inv)
    await db.commit()
    delete_invoice_from_firebase(inv_num)
    return {"success": True}


@invoice_router.post("/{invoice_id}/send-email")
async def send_invoice_email(invoice_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Invoice).where((Invoice.invoice_number == invoice_id) | (Invoice.id == invoice_id))
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    subj, body = build_invoice_email(inv.client_name, inv.invoice_number, float(inv.total_amount or 0), inv.items or [])
    success = await send_email(inv.client_email, subj, body)
    if success:
        inv.status = "sent"
        inv.sent_at = datetime.now(timezone.utc)
        inv.updated_at = datetime.now(timezone.utc)
        await db.commit()
        _sync_invoice_fb(inv)
        await log_activity("invoice", inv.invoice_number, "sent", f"Invoice emailed to {inv.client_email}", "📧", db=db)
        await db.commit()
        return {"success": True, "message": f"Invoice sent to {inv.client_email}"}
    raise HTTPException(500, "Failed to send email")


@invoice_router.post("/{invoice_id}/record-payment")
async def record_payment(invoice_id: str, req: RecordPaymentRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Invoice).where((Invoice.invoice_number == invoice_id) | (Invoice.id == invoice_id))
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    plan = inv.payment_plan or []
    for installment in plan:
        if installment.get("id") == req.installment_id:
            amount = float(req.amount) if req.amount else installment.get("amount", 0)
            installment["status"] = "paid"
            installment["paid_at"] = datetime.now(timezone.utc).isoformat()
            inv.amount_paid = float(inv.amount_paid or 0) + amount
            break
    inv.payment_plan = plan
    if float(inv.amount_paid or 0) >= float(inv.total_amount or 0):
        inv.payment_status = "paid"
        inv.paid_at = datetime.now(timezone.utc)
        inv.status = "paid"
    elif float(inv.amount_paid or 0) > 0:
        inv.payment_status = "partial"
    if req.payment_method:
        inv.payment_method = req.payment_method
    inv.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(inv)
    _sync_invoice_fb(inv)
    await log_activity("invoice", inv.invoice_number, "payment_recorded", f"Payment of ${amount:.2f}", "💰", db=db)
    await db.commit()
    return _invoice_to_response(inv)


# ── Generic email send ──


@email_router.post("/send", response_model=SendEmailResponse)
async def send_generic_email(req: SendEmailRequest):
    success = await send_email(req.to, req.subject, req.body_html)
    if success:
        return {"success": True, "message": f"Email sent to {req.to}"}
    return {"success": False, "message": "Email delivery failed"}
