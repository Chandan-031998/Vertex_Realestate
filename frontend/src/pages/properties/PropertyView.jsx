import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { formatCurrency, getApiError } from "../../utils/ui.js";
import { getUser } from "../../store/auth.store.js";

const STATUS_OPTIONS = ["Available", "Hold", "Booked", "Sold", "Rented"];
const UNIT_STATUS = ["Available", "Hold", "Booked", "Sold", "Rented"];
const DOC_CATEGORIES = ["Khata", "RTC", "EC", "OC", "NOC", "PlanApproval", "Agreement", "TaxReceipt", "Other"];

export default function PropertyView() {
  const { id } = useParams();
  const user = getUser();
  const isAdmin = user?.role === "Admin";
  const isSalesManager = user?.role === "Sales Manager";
  const isPropertyManager = user?.role === "Property Manager";
  const canEditSalesFields = isAdmin || isSalesManager || isPropertyManager;
  const canManageListings = isAdmin;
  const canUploadDocs = isAdmin || isPropertyManager;
  const canManageInventory = isAdmin || isPropertyManager;

  const [property, setProperty] = useState(null);
  const [docs, setDocs] = useState([]);
  const [towers, setTowers] = useState([]);
  const [floors, setFloors] = useState([]);
  const [units, setUnits] = useState([]);
  const [selectedTower, setSelectedTower] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const [salesForm, setSalesForm] = useState({ base_price: "", negotiable: false, status: "Available", video_link: "" });
  const [listingForm, setListingForm] = useState({ is_published: false, is_featured: false, seo_title: "", seo_description: "", seo_keywords: "" });
  const [docForm, setDocForm] = useState({ doc_type: "Khata", file: null });
  const [towerForm, setTowerForm] = useState({ name: "" });
  const [floorForm, setFloorForm] = useState({ floor_no: "" });
  const [unitForm, setUnitForm] = useState({ unit_no: "", bhk: "", area_sqft: "", status: "Available", price: "" });

  const loadProperty = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await http.get(endpoints.propertyById(id));
      const p = res.data.data;
      setProperty(p);
      setSalesForm({
        base_price: p.base_price || "",
        negotiable: Boolean(p.negotiable),
        status: p.status || "Available",
        video_link: p.video_link || "",
      });
      setListingForm({
        is_published: Boolean(p.is_published),
        is_featured: Boolean(p.is_featured),
        seo_title: p.seo_title || "",
        seo_description: p.seo_description || "",
        seo_keywords: p.seo_keywords || "",
      });
    } catch (e) {
      setError(getApiError(e, "Failed to load property"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadDocs = useCallback(async () => {
    try {
      const res = await http.get(endpoints.documents, { params: { property_id: id } });
      setDocs(res.data.data || []);
    } catch {
      // optional on read
    }
  }, [id]);

  const loadTowers = useCallback(async () => {
    try {
      const res = await http.get(endpoints.inventoryTowers, { params: { property_id: id } });
      const rows = res.data.data || [];
      setTowers(rows);
      if (!selectedTower && rows[0]) setSelectedTower(String(rows[0].id));
      if (selectedTower && !rows.find((r) => String(r.id) === String(selectedTower))) {
        setSelectedTower(rows[0] ? String(rows[0].id) : "");
      }
    } catch {
      // optional on read
    }
  }, [id, selectedTower]);

  const loadFloors = useCallback(async () => {
    if (!selectedTower) {
      setFloors([]);
      setSelectedFloor("");
      return;
    }
    try {
      const res = await http.get(endpoints.inventoryFloors, { params: { tower_id: selectedTower } });
      const rows = res.data.data || [];
      setFloors(rows);
      if (!selectedFloor && rows[0]) setSelectedFloor(String(rows[0].id));
      if (selectedFloor && !rows.find((r) => String(r.id) === String(selectedFloor))) {
        setSelectedFloor(rows[0] ? String(rows[0].id) : "");
      }
    } catch {
      // optional on read
    }
  }, [selectedTower, selectedFloor]);

  const loadUnits = useCallback(async () => {
    if (!selectedFloor) {
      setUnits([]);
      return;
    }
    try {
      const res = await http.get(endpoints.inventoryUnits, { params: { floor_id: selectedFloor } });
      setUnits(res.data.data || []);
    } catch {
      // optional on read
    }
  }, [selectedFloor]);

  useEffect(() => {
    loadProperty();
    loadDocs();
    loadTowers();
  }, [loadProperty, loadDocs, loadTowers]);

  useEffect(() => {
    loadFloors();
  }, [loadFloors]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const saveSalesFields = async (e) => {
    e.preventDefault();
    if (!canEditSalesFields) return;
    setError("");
    setMsg("");
    try {
      const payload = isSalesManager
        ? {
            base_price: Number(salesForm.base_price || 0),
            negotiable: salesForm.negotiable,
            status: salesForm.status,
          }
        : {
            base_price: Number(salesForm.base_price || 0),
            negotiable: salesForm.negotiable,
            status: salesForm.status,
            video_link: salesForm.video_link || null,
          };
      await http.put(endpoints.propertyById(id), payload);
      setMsg("Property updated");
      await loadProperty();
    } catch (e2) {
      setError(getApiError(e2, "Failed to update property"));
    }
  };

  const uploadDoc = async (e) => {
    e.preventDefault();
    if (!canUploadDocs) return;
    setError("");
    setMsg("");
    if (!docForm.file) {
      setError("Select a file");
      return;
    }
    const fd = new FormData();
    fd.append("property_id", String(id));
    fd.append("doc_type", docForm.doc_type);
    fd.append("file", docForm.file);
    try {
      await http.post(endpoints.documents, fd);
      setDocForm({ ...docForm, file: null });
      setMsg("Document uploaded");
      await loadDocs();
    } catch (e2) {
      setError(getApiError(e2, "Failed to upload document"));
    }
  };

  const saveListingSettings = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      await http.patch(endpoints.propertyListingSettings(id), listingForm);
      setMsg("Listing settings updated");
      await loadProperty();
    } catch (e2) {
      setError(getApiError(e2, "Failed to update listing settings"));
    }
  };

  const addTower = async (e) => {
    e.preventDefault();
    if (!canManageInventory) return;
    if (!towerForm.name.trim()) return;
    try {
      await http.post(endpoints.inventoryTowers, { property_id: Number(id), name: towerForm.name.trim() });
      setTowerForm({ name: "" });
      await loadTowers();
    } catch (e2) {
      setError(getApiError(e2, "Failed to add tower"));
    }
  };

  const updateTower = async (towerId, name) => {
    if (!canManageInventory) return;
    try {
      await http.put(`${endpoints.inventoryTowers}/${towerId}`, { name });
      setMsg("Tower updated");
      await loadTowers();
    } catch (e) {
      setError(getApiError(e, "Failed to update tower"));
    }
  };

  const deleteTower = async (towerId) => {
    if (!canManageInventory) return;
    if (!window.confirm("Delete tower and all its floors/units?")) return;
    try {
      await http.delete(`${endpoints.inventoryTowers}/${towerId}`);
      await loadTowers();
    } catch (e) {
      setError(getApiError(e, "Failed to delete tower"));
    }
  };

  const addFloor = async (e) => {
    e.preventDefault();
    if (!canManageInventory) return;
    if (!selectedTower || !floorForm.floor_no) return;
    try {
      await http.post(endpoints.inventoryFloors, { tower_id: Number(selectedTower), floor_no: Number(floorForm.floor_no) });
      setFloorForm({ floor_no: "" });
      await loadFloors();
    } catch (e2) {
      setError(getApiError(e2, "Failed to add floor"));
    }
  };

  const updateFloor = async (floorId, floor_no) => {
    if (!canManageInventory) return;
    try {
      await http.put(`${endpoints.inventoryFloors}/${floorId}`, { floor_no: Number(floor_no) });
      await loadFloors();
    } catch (e) {
      setError(getApiError(e, "Failed to update floor"));
    }
  };

  const deleteFloor = async (floorId) => {
    if (!canManageInventory) return;
    if (!window.confirm("Delete floor and all units?")) return;
    try {
      await http.delete(`${endpoints.inventoryFloors}/${floorId}`);
      await loadFloors();
    } catch (e) {
      setError(getApiError(e, "Failed to delete floor"));
    }
  };

  const addUnit = async (e) => {
    e.preventDefault();
    if (!canManageInventory) return;
    if (!selectedFloor || !unitForm.unit_no.trim()) return;
    try {
      await http.post(endpoints.inventoryUnits, {
        floor_id: Number(selectedFloor),
        unit_no: unitForm.unit_no.trim(),
        bhk: unitForm.bhk,
        area_sqft: unitForm.area_sqft ? Number(unitForm.area_sqft) : null,
        status: unitForm.status,
        price: unitForm.price ? Number(unitForm.price) : 0,
      });
      setUnitForm({ unit_no: "", bhk: "", area_sqft: "", status: "Available", price: "" });
      await loadUnits();
    } catch (e2) {
      setError(getApiError(e2, "Failed to add unit"));
    }
  };

  const updateUnit = async (unit) => {
    if (!canManageInventory) return;
    try {
      await http.put(`${endpoints.inventoryUnits}/${unit.id}`, {
        unit_no: unit.unit_no,
        bhk: unit.bhk,
        area_sqft: unit.area_sqft,
        status: unit.status,
        price: unit.price,
      });
      await loadUnits();
    } catch (e) {
      setError(getApiError(e, "Failed to update unit"));
    }
  };

  const deleteUnit = async (unitId) => {
    if (!canManageInventory) return;
    if (!window.confirm("Delete this unit?")) return;
    try {
      await http.delete(`${endpoints.inventoryUnits}/${unitId}`);
      await loadUnits();
    } catch (e) {
      setError(getApiError(e, "Failed to delete unit"));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-bold">Property View</div>
          <div className="text-sm text-slate-600">ID, QR, gallery, brochure, inventory, and document vault</div>
        </div>
        <Link className="text-sm underline" to="/app/properties">Back to Properties</Link>
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
      {msg && <div className="mt-4 text-sm text-green-700">{msg}</div>}

      {!property && loading && <div className="mt-6 text-sm">Loading...</div>}

      {property && (
        <div className="mt-4 space-y-4">
          <div className="bg-white border rounded-2xl p-4 grid md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-slate-500">Property ID</div>
              <div className="font-mono text-sm">{property.property_uid}</div>
              <div className="text-xs text-slate-500 mt-2">Title</div>
              <div>{property.title}</div>
              <div className="text-xs text-slate-500 mt-2">Current Status</div>
              <div>{property.status}</div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${property.is_published ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}`}>
                  {property.is_published ? "Published" : "Unpublished"}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${property.is_featured ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
                  {property.is_featured ? "Featured" : "Standard"}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-2">Price</div>
              <div>{formatCurrency(property.base_price)}</div>
              {property.brochure_url && (
                <a className="underline text-sm mt-3 inline-block" href={property.brochure_url} target="_blank" rel="noreferrer">
                  Open Brochure PDF
                </a>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-500">QR (links to this property page)</div>
              {property.qr_url ? <img src={property.qr_url} alt="Property QR" className="mt-2 w-40 h-40 border rounded" /> : <div className="mt-2 text-sm">No QR</div>}
            </div>
            <form onSubmit={saveSalesFields} className="grid gap-2">
              <div className="text-xs text-slate-500">Quick Update</div>
              <input
                className="border rounded-xl px-3 py-2"
                type="number"
                placeholder="Base price"
                value={salesForm.base_price}
                disabled={!canEditSalesFields}
                onChange={(e) => setSalesForm({ ...salesForm, base_price: e.target.value })}
              />
              <select className="border rounded-xl px-3 py-2" value={salesForm.status} disabled={!canEditSalesFields} onChange={(e) => setSalesForm({ ...salesForm, status: e.target.value })}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <label className="text-sm">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={Boolean(salesForm.negotiable)}
                  disabled={!canEditSalesFields}
                  onChange={(e) => setSalesForm({ ...salesForm, negotiable: e.target.checked })}
                />
                Negotiable
              </label>
              {!isSalesManager && (
                <input
                  className="border rounded-xl px-3 py-2"
                  placeholder="Video URL"
                  value={salesForm.video_link}
                  disabled={!canEditSalesFields}
                  onChange={(e) => setSalesForm({ ...salesForm, video_link: e.target.value })}
                />
              )}
              {canEditSalesFields ? (
                <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm" type="submit">Save</button>
              ) : (
                <div className="text-xs text-slate-500">Read only access for your role.</div>
              )}
            </form>
          </div>

          {canManageListings && (
            <form onSubmit={saveListingSettings} className="bg-white border rounded-2xl p-4">
              <div className="font-semibold">Marketing & Listings</div>
              <div className="text-xs text-slate-500">Publish approved listing, featured flag, and SEO metadata</div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <label className="text-sm">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={Boolean(listingForm.is_published)}
                    onChange={(e) => setListingForm({ ...listingForm, is_published: e.target.checked })}
                  />
                  Publish to website
                </label>
                <label className="text-sm">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={Boolean(listingForm.is_featured)}
                    onChange={(e) => setListingForm({ ...listingForm, is_featured: e.target.checked })}
                  />
                  Featured property
                </label>
                <input
                  className="border rounded-xl px-3 py-2 md:col-span-2"
                  placeholder="SEO title"
                  value={listingForm.seo_title}
                  onChange={(e) => setListingForm({ ...listingForm, seo_title: e.target.value })}
                />
                <input
                  className="border rounded-xl px-3 py-2 md:col-span-2"
                  placeholder="SEO meta description"
                  value={listingForm.seo_description}
                  onChange={(e) => setListingForm({ ...listingForm, seo_description: e.target.value })}
                />
                <input
                  className="border rounded-xl px-3 py-2 md:col-span-2"
                  placeholder="SEO keywords (comma separated)"
                  value={listingForm.seo_keywords}
                  onChange={(e) => setListingForm({ ...listingForm, seo_keywords: e.target.value })}
                />
                <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm md:col-span-2">Save Listing Settings</button>
              </div>
            </form>
          )}

          <div className="bg-white border rounded-2xl p-4">
            <div className="font-semibold">Image Gallery</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              {(property.images || []).map((img) => (
                <img key={img.id} src={img.url} alt="property" className="w-full h-28 object-cover rounded-lg border" />
              ))}
              {!property.images?.length && <div className="text-sm text-slate-500">No images uploaded.</div>}
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4">
            <div className="font-semibold">Document Vault (Categories + Versioning)</div>
            {canUploadDocs && (
              <form onSubmit={uploadDoc} className="grid md:grid-cols-4 gap-2 mt-3">
                <select className="border rounded-xl px-3 py-2" value={docForm.doc_type} onChange={(e) => setDocForm({ ...docForm, doc_type: e.target.value })}>
                  {DOC_CATEGORIES.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                <input className="border rounded-xl px-3 py-2" type="file" onChange={(e) => setDocForm({ ...docForm, file: e.target.files?.[0] || null })} />
                <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">Upload Document</button>
              </form>
            )}
            <div className="mt-3 space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                  <div>
                    <span className="font-semibold">{d.doc_type}</span>
                    <span className="ml-2 text-slate-600">v{d.version_no}</span>
                    {d.original_name && <span className="ml-2 text-slate-500">{d.original_name}</span>}
                  </div>
                  <a className="underline" href={d.url} target="_blank" rel="noreferrer">Open</a>
                </div>
              ))}
              {!docs.length && <div className="text-sm text-slate-500">No documents yet.</div>}
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4">
            <div className="font-semibold">Tower → Floor → Unit Inventory</div>

            {canManageInventory && (
              <form className="mt-3 flex gap-2" onSubmit={addTower}>
                <input
                  className="border rounded-xl px-3 py-2"
                  placeholder="New tower name"
                  value={towerForm.name}
                  onChange={(e) => setTowerForm({ name: e.target.value })}
                />
                <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">Add Tower</button>
              </form>
            )}

            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <div className="border rounded-xl p-3">
                <div className="text-sm font-semibold">Towers</div>
                <div className="space-y-2 mt-2">
                  {towers.map((t) => (
                    <div key={t.id} className="flex gap-2 items-center">
                      <button
                        type="button"
                        className={`px-2 py-1 rounded ${String(t.id) === String(selectedTower) ? "bg-slate-900 text-white" : "bg-slate-100"}`}
                        onClick={() => setSelectedTower(String(t.id))}
                      >
                        #{t.id}
                      </button>
                      <input
                        className="border rounded px-2 py-1 flex-1"
                        defaultValue={t.name}
                        readOnly={!canManageInventory}
                        onBlur={(e) => updateTower(t.id, e.target.value)}
                      />
                      {canManageInventory && <button type="button" className="text-red-600" onClick={() => deleteTower(t.id)}>Delete</button>}
                    </div>
                  ))}
                  {!towers.length && <div className="text-sm text-slate-500">No towers.</div>}
                </div>
              </div>

              <div className="border rounded-xl p-3">
                <div className="text-sm font-semibold">Floors</div>
                {canManageInventory && (
                  <form className="mt-2 flex gap-2" onSubmit={addFloor}>
                    <input
                      className="border rounded px-2 py-1"
                      placeholder="Floor no"
                      type="number"
                      value={floorForm.floor_no}
                      onChange={(e) => setFloorForm({ floor_no: e.target.value })}
                    />
                    <button className="px-2 py-1 rounded bg-slate-900 text-white">Add</button>
                  </form>
                )}
                <div className="space-y-2 mt-2">
                  {floors.map((f) => (
                    <div key={f.id} className="flex gap-2 items-center">
                      <button
                        type="button"
                        className={`px-2 py-1 rounded ${String(f.id) === String(selectedFloor) ? "bg-slate-900 text-white" : "bg-slate-100"}`}
                        onClick={() => setSelectedFloor(String(f.id))}
                      >
                        #{f.id}
                      </button>
                      <input
                        className="border rounded px-2 py-1 w-24"
                        type="number"
                        defaultValue={f.floor_no}
                        readOnly={!canManageInventory}
                        onBlur={(e) => updateFloor(f.id, e.target.value)}
                      />
                      {canManageInventory && <button type="button" className="text-red-600" onClick={() => deleteFloor(f.id)}>Delete</button>}
                    </div>
                  ))}
                  {!floors.length && <div className="text-sm text-slate-500">No floors.</div>}
                </div>
              </div>
            </div>

            <div className="border rounded-xl p-3 mt-3">
              <div className="text-sm font-semibold">Units</div>
              {canManageInventory && (
                <form className="mt-2 grid md:grid-cols-6 gap-2" onSubmit={addUnit}>
                  <input className="border rounded px-2 py-1" placeholder="Unit no" value={unitForm.unit_no} onChange={(e) => setUnitForm({ ...unitForm, unit_no: e.target.value })} />
                  <input className="border rounded px-2 py-1" placeholder="BHK" value={unitForm.bhk} onChange={(e) => setUnitForm({ ...unitForm, bhk: e.target.value })} />
                  <input className="border rounded px-2 py-1" type="number" placeholder="Area sqft" value={unitForm.area_sqft} onChange={(e) => setUnitForm({ ...unitForm, area_sqft: e.target.value })} />
                  <select className="border rounded px-2 py-1" value={unitForm.status} onChange={(e) => setUnitForm({ ...unitForm, status: e.target.value })}>
                    {UNIT_STATUS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <input className="border rounded px-2 py-1" type="number" placeholder="Price" value={unitForm.price} onChange={(e) => setUnitForm({ ...unitForm, price: e.target.value })} />
                  <button className="px-2 py-1 rounded bg-slate-900 text-white">Add Unit</button>
                </form>
              )}

              <div className="mt-2 space-y-2">
                {units.map((u) => (
                  <UnitRow key={u.id} unit={u} onSave={updateUnit} onDelete={deleteUnit} canEdit={canManageInventory} />
                ))}
                {!units.length && <div className="text-sm text-slate-500">No units.</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UnitRow({ unit, onSave, onDelete, canEdit }) {
  const [row, setRow] = useState(unit);

  useEffect(() => {
    setRow(unit);
  }, [unit]);

  return (
    <div className="grid md:grid-cols-7 gap-2 items-center border rounded-lg p-2 text-sm">
      <input className="border rounded px-2 py-1" value={row.unit_no || ""} readOnly={!canEdit} onChange={(e) => setRow({ ...row, unit_no: e.target.value })} />
      <input className="border rounded px-2 py-1" value={row.bhk || ""} readOnly={!canEdit} onChange={(e) => setRow({ ...row, bhk: e.target.value })} />
      <input className="border rounded px-2 py-1" type="number" value={row.area_sqft || ""} readOnly={!canEdit} onChange={(e) => setRow({ ...row, area_sqft: e.target.value })} />
      <select className="border rounded px-2 py-1" value={row.status || "Available"} disabled={!canEdit} onChange={(e) => setRow({ ...row, status: e.target.value })}>
        {UNIT_STATUS.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <input className="border rounded px-2 py-1" type="number" value={row.price || ""} readOnly={!canEdit} onChange={(e) => setRow({ ...row, price: e.target.value })} />
      {canEdit ? (
        <>
          <button type="button" className="px-2 py-1 rounded bg-slate-900 text-white" onClick={() => onSave(row)}>Save</button>
          <button type="button" className="text-red-600" onClick={() => onDelete(row.id)}>Delete</button>
        </>
      ) : (
        <div className="text-xs text-slate-500 md:col-span-2">Read only</div>
      )}
    </div>
  );
}
