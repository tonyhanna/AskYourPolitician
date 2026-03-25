"use client";

import { useState } from "react";
import { createAdmin, updateAdmin, deleteAdmin } from "@/app/admin/actions";

type Admin = {
  id: string;
  email: string;
  name: string | null;
  permissions: string;
  createdAt: Date;
};

type Props = {
  admins: Admin[];
  currentAdminEmail: string;
};

export function AdminUserList({ admins: initialAdmins, currentAdminEmail }: Props) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      const admin = await createAdmin(newEmail.trim(), newName.trim() || null);
      setAdmins((prev) => [...prev, admin]);
      setNewEmail("");
      setNewName("");
      setShowAdd(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fejl ved oprettelse");
    }
    setAdding(false);
  };

  const handleEdit = (admin: Admin) => {
    setEditingId(admin.id);
    setEditEmail(admin.email);
    setEditName(admin.name || "");
  };

  const handleSave = async (id: string) => {
    if (!editEmail.trim()) return;
    setSaving(true);
    try {
      await updateAdmin(id, editEmail.trim(), editName.trim() || null);
      setAdmins((prev) =>
        prev.map((a) => (a.id === id ? { ...a, email: editEmail.trim(), name: editName.trim() || null } : a))
      );
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fejl ved opdatering");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Er du sikker på at du vil slette denne admin?")) return;
    setDeletingId(id);
    try {
      await deleteAdmin(id);
      setAdmins((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fejl ved sletning");
    }
    setDeletingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Admin-brugere</h2>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition cursor-pointer"
          >
            Tilføj admin
          </button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="admin@eksempel.dk"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Navn (valgfrit)</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Fornavn Efternavn"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adding}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
            >
              {adding ? "Tilføjer..." : "Tilføj"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setNewEmail(""); setNewName(""); }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition cursor-pointer"
            >
              Annuller
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
        {admins.map((admin) => {
          const isCurrentUser = admin.email === currentAdminEmail;
          const isEditing = editingId === admin.id;

          return (
            <div key={admin.id} className="px-4 py-3 flex items-center gap-4">
              {isEditing ? (
                <div className="flex-1 space-y-2">
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Navn (valgfrit)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(admin.id)}
                      disabled={saving}
                      className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer disabled:opacity-50"
                    >
                      {saving ? "Gemmer..." : "Gem"}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
                    >
                      Annuller
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {admin.email}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-gray-400">(dig)</span>
                      )}
                    </p>
                    {admin.name && (
                      <p className="text-xs text-gray-500">{admin.name}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      Rettigheder: {admin.permissions === '["all"]' ? "Alle" : admin.permissions}
                    </p>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button
                      onClick={() => handleEdit(admin)}
                      className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      Rediger
                    </button>
                    {!isCurrentUser && (
                      <button
                        onClick={() => handleDelete(admin.id)}
                        disabled={deletingId === admin.id}
                        className="text-sm text-red-600 hover:text-red-800 cursor-pointer disabled:opacity-50"
                      >
                        {deletingId === admin.id ? "Sletter..." : "Slet"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
