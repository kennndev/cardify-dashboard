'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AccessPage() {
  const [list, setList] = useState<
    { id: number; email: string; role: 'super_admin' | 'admin' }[]
  >([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'super_admin'>('admin');

  // Load roles from Supabase
  async function load() {
    const res = await fetch('/api/roles');
    const data = await res.json();
    console.log('Loaded roles:', data);
    setList(data);
  }

  // Add a new role
  async function add() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      alert('Email is required');
      return;
    }

    const res = await fetch('/api/roles', {
      method: 'POST',
      body: JSON.stringify({ email: trimmedEmail, role }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await res.json();
    console.log('ADD result:', result);

    if (!res.ok) {
      alert('Add failed: ' + result.error);
      return;
    }

    // Append new entry to list
    setList((prev) => [...prev, result]);
    setEmail('');
  }

  // Remove an entry by ID
  async function remove(id: number) {
    console.log('Removing ID:', id);

    const res = await fetch('/api/roles', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await res.json();
    console.log('Delete result:', result);

    if (!res.ok) {
      alert('Failed to delete: ' + result.error);
      return;
    }

    // Remove from list without refetching
    setList((prev) => prev.filter((user) => user.id !== id));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-xl mx-auto p-8 space-y-8">
      {/* 🏠 Home link */}
      <Link
        href="/"
        className="inline-block px-4 py-2 rounded-xl bg-white/80 text-purple-700 hover:bg-white transition shadow-sm"
      >
        🏠
      </Link>

      <h1 className="text-3xl font-bold">Dashboard Access</h1>

      {/* Add Form */}
      <div className="flex space-x-4">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          className="flex-1 px-4 py-2 border rounded-xl"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
          className="px-4 py-2 border rounded-xl"
        >
          <option value="admin">admin</option>
          <option value="super_admin">super_admin</option>
        </select>
        <button
          onClick={add}
          className="px-6 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition"
        >
          Add
        </button>
      </div>

      {/* List */}
      <ul className="space-y-2">
        {console.log('Rendering list:', list)}
        {list.map((u) => (
          <li
            key={u.id}
            className="flex justify-between items-center bg-white/70 p-3 rounded-xl"
          >
            <span>
              {u.email} ({u.role})
            </span>
            <button
              onClick={() => remove(u.id)}
              title="Remove"
              className="hover:text-red-600 transition"
            >
              🗑️
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
