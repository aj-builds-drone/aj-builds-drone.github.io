"""
AJ Builds Drone — Route endpoint tests.
"""

import pytest


class TestRootEndpoints:

    async def test_root(self, client):
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["service"] == "AJ Builds Drone — Outreach API"
        assert "contracts" in data["endpoints"]

    async def test_health(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestOutreachRoutes:

    async def test_stats(self, client):
        resp = await client.get("/outreach/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_prospects" in data
        assert "by_tier" in data
        assert "emails_sent" in data

    async def test_funnel(self, client):
        resp = await client.get("/outreach/funnel")
        assert resp.status_code == 200
        data = resp.json()
        assert "funnel" in data
        assert "stages" in data
        assert "discovered" in data["stages"]

    async def test_list_prospects_empty(self, client):
        resp = await client.get("/outreach/prospects")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["prospects"] == []

    async def test_create_prospect(self, client):
        resp = await client.post("/outreach/prospects", json={
            "name": "Dr. Test",
            "email": "test@mit.edu",
            "organization": "MIT",
            "department": "Aerospace",
            "source": "manual",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Dr. Test"
        assert data["status"] == "discovered"

    async def test_list_prospects_with_data(self, client):
        await client.post("/outreach/prospects", json={
            "name": "Dr. A",
            "email": "a@test.edu",
            "source": "manual",
        })
        resp = await client.get("/outreach/prospects")
        data = resp.json()
        assert data["total"] >= 1

    async def test_top_prospects(self, client):
        resp = await client.get("/outreach/top-prospects")
        assert resp.status_code == 200

    async def test_agent_status(self, client):
        resp = await client.get("/outreach/agents/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "agents" in data


class TestEmailApprovalRoutes:
    """CRITICAL: Test human-in-the-loop email approval flow."""

    async def test_email_queue_empty(self, client):
        resp = await client.get("/outreach/email-queue")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0

    async def test_approve_nonexistent_email(self, client):
        import uuid
        fake_id = str(uuid.uuid4())
        resp = await client.post(f"/outreach/email-queue/{fake_id}/approve")
        assert resp.status_code == 404

    async def test_reject_nonexistent_email(self, client):
        import uuid
        fake_id = str(uuid.uuid4())
        resp = await client.post(f"/outreach/email-queue/{fake_id}/reject")
        assert resp.status_code == 404


class TestContractRoutes:

    async def test_list_contracts_empty(self, client):
        resp = await client.get("/contracts")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0

    async def test_create_contract(self, client):
        resp = await client.post("/contracts", json={
            "client_name": "Test Client",
            "client_email": "client@test.com",
            "project_name": "Drone Custom Build",
            "total_amount": 5000,
            "deposit_amount": 1000,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["client_name"] == "Test Client"
        assert data["status"] == "draft"
        assert data["provider_name"] == "AjayaDesign"
        assert data["sign_token"]  # has a sign token

    async def test_get_contract(self, client):
        create = await client.post("/contracts", json={
            "client_name": "Lookup Client",
            "client_email": "lookup@test.com",
            "project_name": "Test Project",
        })
        short_id = create.json()["short_id"]

        resp = await client.get(f"/contracts/{short_id}")
        assert resp.status_code == 200
        assert resp.json()["client_name"] == "Lookup Client"

    async def test_update_contract(self, client):
        create = await client.post("/contracts", json={
            "client_name": "Update Client",
            "client_email": "update@test.com",
            "project_name": "Original",
        })
        short_id = create.json()["short_id"]

        resp = await client.patch(f"/contracts/{short_id}", json={
            "project_name": "Updated Project",
        })
        assert resp.status_code == 200
        assert resp.json()["project_name"] == "Updated Project"

    async def test_delete_contract(self, client):
        create = await client.post("/contracts", json={
            "client_name": "Delete Client",
            "client_email": "delete@test.com",
            "project_name": "To Delete",
        })
        short_id = create.json()["short_id"]

        resp = await client.delete(f"/contracts/{short_id}")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    async def test_sign_contract(self, client):
        create = await client.post("/contracts", json={
            "client_name": "Sign Client",
            "client_email": "sign@test.com",
            "project_name": "Sign Project",
        })
        sign_token = create.json()["sign_token"]

        resp = await client.get(f"/contracts/sign/{sign_token}")
        assert resp.status_code == 200

        resp = await client.post(f"/contracts/sign/{sign_token}", json={
            "signer_name": "Sign Client",
            "signature_data": "data:image/png;base64,iVBORw0KGgo=",
        })
        assert resp.status_code == 200
        assert resp.json()["success"] is True


class TestInvoiceRoutes:

    async def test_list_invoices_empty(self, client):
        resp = await client.get("/invoices")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    async def test_create_invoice(self, client):
        resp = await client.post("/invoices", json={
            "client_name": "Invoice Client",
            "client_email": "invoice@test.com",
            "total_amount": 2500,
            "items": [{"description": "PCB Design", "quantity": 1, "unit_price": 2500, "amount": 2500}],
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["invoice_number"].startswith("DRONE-INV-")
        assert data["provider_name"] == "AjayaDesign"


class TestActivityRoutes:

    async def test_list_activities_empty(self, client):
        resp = await client.get("/activity")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    async def test_create_activity(self, client):
        resp = await client.post("/activity", json={
            "entity_type": "contract",
            "entity_id": "test123",
            "action": "created",
            "description": "Test activity",
        })
        assert resp.status_code == 200
        assert resp.json()["success"] is True
