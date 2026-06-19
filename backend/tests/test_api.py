def employee_payload(nama: str = "Dimas Saputra") -> dict:
    return {
        "nama": nama,
        "jabatan": "Software Engineer",
        "departemen": "Engineering",
        "tanggal_masuk": "2024-01-15",
        "status_aktif": True,
    }


def test_employee_crud(client, admin_headers):
    created = client.post("/employees", json=employee_payload(), headers=admin_headers)
    assert created.status_code == 201
    employee_id = created.json()["id"]

    listed = client.get("/employees", headers=admin_headers)
    assert listed.status_code == 200
    assert listed.json()["items"][0]["nama"] == "Dimas Saputra"
    assert listed.json()["total"] == 1
    assert client.get(f"/employees/{employee_id}", headers=admin_headers).json()["id"] == employee_id

    updated_payload = employee_payload("Dimas Pratama")
    updated_payload["jabatan"] = "Senior Software Engineer"
    updated = client.put(f"/employees/{employee_id}", json=updated_payload, headers=admin_headers)
    assert updated.status_code == 200
    assert updated.json()["jabatan"] == "Senior Software Engineer"

    deleted = client.delete(f"/employees/{employee_id}", headers=admin_headers)
    assert deleted.status_code == 204
    assert client.get("/employees", headers=admin_headers).json()["items"] == []


def test_leave_crud_calculates_days_and_blocks_overlap(client, admin_headers):
    employee = client.post("/employees", json=employee_payload(), headers=admin_headers).json()
    leave_payload = {
        "employee_id": employee["id"],
        "leave_type": "Cuti Tahunan",
        "start_date": "2026-06-10",
        "end_date": "2026-06-12",
        "description": "Keperluan keluarga",
    }

    created = client.post("/employee-leaves", json=leave_payload, headers=admin_headers)
    assert created.status_code == 201
    assert created.json()["total_days"] == 3
    leave_id = created.json()["id"]
    assert client.get(f"/employee-leaves/{leave_id}", headers=admin_headers).json()["id"] == leave_id

    overlap = client.post(
        "/employee-leaves",
        json={**leave_payload, "start_date": "2026-06-12", "end_date": "2026-06-13"}, headers=admin_headers,
    )
    assert overlap.status_code == 409
    assert overlap.json()["error"]["code"] == "LEAVE_OVERLAP"

    override = client.post(
        "/employee-leaves",
        json={
            **leave_payload,
            "start_date": "2026-06-12",
            "end_date": "2026-06-13",
            "override_overlap": True,
        }, headers=admin_headers,
    )
    assert override.status_code == 201

    summary = client.get("/employee-leaves/summary?month=6&year=2026", headers=admin_headers)
    assert summary.status_code == 200
    summary_body = summary.json()
    assert summary_body["total_cuti_bulan_ini"] == 2
    assert summary_body["total_hari_cuti_terpakai_bulan_ini"] == 5
    assert summary_body["karyawan_dengan_cuti_terbanyak"][0]["total_days"] == 5

    dashboard = client.get("/dashboard/summary", headers=admin_headers)
    assert dashboard.status_code == 200
    dashboard_body = dashboard.json()
    assert dashboard_body["total_active_employees"] == 1
    assert dashboard_body["recent_leaves"][0]["employee_name"] == "Dimas Saputra"

    updated = client.put(
        f"/employee-leaves/{leave_id}",
        json={**leave_payload, "start_date": "2026-07-01", "end_date": "2026-07-01"}, headers=admin_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["total_days"] == 1

    assert client.delete(f"/employee-leaves/{leave_id}", headers=admin_headers).status_code == 204


def test_rejects_invalid_employee_and_date_range(client, admin_headers):
    invalid_employee = client.post(
        "/employee-leaves",
        json={
            "employee_id": 999,
            "leave_type": "Cuti Sakit",
            "start_date": "2026-06-10",
            "end_date": "2026-06-10",
        }, headers=admin_headers,
    )
    assert invalid_employee.status_code == 404
    assert invalid_employee.json()["error"]["code"] == "NOT_FOUND"

    invalid_dates = client.post(
        "/employee-leaves",
        json={
            "employee_id": 999,
            "leave_type": "Cuti Sakit",
            "start_date": "2026-06-12",
            "end_date": "2026-06-10",
        }, headers=admin_headers,
    )
    assert invalid_dates.status_code == 422
    assert invalid_dates.json()["error"]["code"] == "VALIDATION_ERROR"


def test_list_pagination_and_filters(client, admin_headers):
    for index in range(3):
        payload = employee_payload(f"Karyawan {index + 1}")
        payload["status_aktif"] = index != 2
        assert client.post("/employees", json=payload, headers=admin_headers).status_code == 201

    first_page = client.get("/employees?page=1&page_size=2", headers=admin_headers)
    assert first_page.status_code == 200
    assert first_page.json()["total"] == 3
    assert first_page.json()["pages"] == 2
    assert len(first_page.json()["items"]) == 2

    active = client.get("/employees?status_aktif=true", headers=admin_headers)
    assert active.json()["total"] == 2
