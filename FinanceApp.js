'use client'
import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { supabase } from "../lib/supabase";

const CATEGORIES = {
  expense: [
    { id: "food", label: "🍜 อาหาร", color: "#FF6B6B" },
    { id: "transport", label: "🚗 เดินทาง", color: "#FFA726" },
    { id: "room", label: "🏠 ของเข้าห้อง/บ้าน", color: "#AB47BC" },
    { id: "health", label: "💊 สุขภาพ", color: "#26C6DA" },
    { id: "shopping", label: "🛍️ ช้อปปิ้ง", color: "#EC407A" },
    { id: "entertainment", label: "🎮 บันเทิง", color: "#7E57C2" },
    { id: "education", label: "📚 การศึกษา", color: "#42A5F5" },
    { id: "other_expense", label: "📦 อื่นๆ", color: "#78909C" },
  ],
  income: [
    { id: "family", label: "👨‍👩‍👧 รับจากครอบครัว", color: "#66BB6A" },
    { id: "salary", label: "💼 เงินเดือน/ทำงาน", color: "#26A69A" },
    { id: "freelance", label: "💻 ฟรีแลนซ์", color: "#D4E157" },
    { id: "other_income", label: "💰 อื่นๆ", color: "#8D6E63" },
  ],
};

const ALL_CATS = [...CATEGORIES.expense, ...CATEGORIES.income];
const getCat = (id) => ALL_CATS.find((c) => c.id === id) || { label: id, color: "#aaa" };
const fmt = (n) => Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().split("T")[0];

const TABS = ["บันทึก", "สรุป", "งบประมาณ"];
const PERIOD_TABS = ["วันนี้", "สัปดาห์นี้", "เดือนนี้"];

export default function FinanceApp() {
  const [tab, setTab] = useState("บันทึก");
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [form, setForm] = useState({ type: "expense", category: "food", amount: "", note: "", date: today() });
  const [period, setPeriod] = useState("เดือนนี้");
  const [toast, setToast] = useState(null);
  const [editId, setEditId] = useState(null);
  const [budgetInput, setBudgetInput] = useState({});
  const [chartType, setChartType] = useState("pie");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: txData }, { data: bdData }] = await Promise.all([
      supabase.from("transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("budgets").select("*"),
    ]);
    if (txData) setTransactions(txData);
    if (bdData) {
      const map = {};
      bdData.forEach(b => { map[b.category] = b.amount; });
      setBudgets(map);
    }
    setLoading(false);
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const filtered = useMemo(() => {
    const now = new Date();
    return transactions.filter((t) => {
      const d = new Date(t.date);
      if (period === "วันนี้") return t.date === today();
      if (period === "สัปดาห์นี้") {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        return d >= startOfWeek;
      }
      if (period === "เดือนนี้") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [transactions, period]);

  const totalIncome = filtered.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const expenseByCat = useMemo(() => {
    const map = {};
    filtered.filter(t => t.type === "expense").forEach(t => { map[t.category] = (map[t.category] || 0) + Number(t.amount); });
    return Object.entries(map).map(([id, value]) => ({ id, ...getCat(id), value }));
  }, [filtered]);

  const dailyData = useMemo(() => {
    const map = {};
    filtered.forEach(t => {
      if (!map[t.date]) map[t.date] = { date: t.date, income: 0, expense: 0 };
      map[t.date][t.type] += Number(t.amount);
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({ ...d, date: d.date.slice(5) }));
  }, [filtered]);

  const handleSubmit = async () => {
    if (!form.amount || isNaN(+form.amount) || +form.amount <= 0) return showToast("กรุณาใส่จำนวนเงินที่ถูกต้อง", "error");
    if (!form.note.trim()) return showToast("กรุณาใส่รายละเอียด", "error");
    const payload = { type: form.type, category: form.category, amount: +form.amount, note: form.note, date: form.date };
    if (editId) {
      const { error } = await supabase.from("transactions").update(payload).eq("id", editId);
      if (error) return showToast("เกิดข้อผิดพลาด", "error");
      setTransactions(prev => prev.map(t => t.id === editId ? { ...t, ...payload } : t));
      setEditId(null);
      showToast("แก้ไขสำเร็จ ✓");
    } else {
      const { data, error } = await supabase.from("transactions").insert(payload).select().single();
      if (error) return showToast("เกิดข้อผิดพลาด", "error");
      setTransactions(prev => [data, ...prev]);
      showToast("บันทึกสำเร็จ ✓");
    }
    setForm({ type: "expense", category: "food", amount: "", note: "", date: today() });
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return showToast("เกิดข้อผิดพลาด", "error");
    setTransactions(prev => prev.filter(t => t.id !== id));
    showToast("ลบรายการแล้ว", "error");
  };

  const handleEdit = (t) => {
    setForm({ type: t.type, category: t.category, amount: String(t.amount), note: t.note, date: t.date });
    setEditId(t.id);
    setTab("บันทึก");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveBudgets = async () => {
    const updates = Object.entries(budgetInput).filter(([, v]) => v).map(([category, amount]) => ({ category, amount: +amount }));
    if (updates.length === 0) return;
    const { error } = await supabase.from("budgets").upsert(updates, { onConflict: "category" });
    if (error) return showToast("เกิดข้อผิดพลาด", "error");
    const merged = { ...budgets };
    updates.forEach(u => { merged[u.category] = u.amount; });
    setBudgets(merged);
    setBudgetInput({});
    showToast("บันทึกงบประมาณแล้ว ✓");
  };

  const monthlyExpenseByCat = (catId) => {
    const now = new Date();
    return transactions.filter(t => {
      const d = new Date(t.date);
      return t.type === "expense" && t.category === catId && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, t) => s + Number(t.amount), 0);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f0c29, #1a1a2e, #16213e)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "'Sarabun', sans-serif", color: "#a78bfa" }}>
      <div style={{ fontSize: 40 }}>💸</div>
      <div style={{ fontSize: 16 }}>กำลังโหลด...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f0c29, #1a1a2e, #16213e)", fontFamily: "'Sarabun', sans-serif", color: "#e8e8f0", position: "relative" }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: toast.type === "error" ? "#c0392b" : "#27ae60", color: "#fff", padding: "10px 24px", borderRadius: 40, fontWeight: 600, fontSize: 15, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .card { background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; animation: slideUp 0.4s ease; }
        .btn-primary { background: linear-gradient(135deg, #a78bfa, #7c3aed); color: #fff; border: none; border-radius: 12px; padding: 12px 24px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: 'Sarabun', sans-serif; transition: all 0.2s; width: 100%; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(124,58,237,0.4); }
        .input-style { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; color: #e8e8f0; padding: 10px 14px; font-size: 15px; font-family: 'Sarabun', sans-serif; width: 100%; box-sizing: border-box; outline: none; }
        .input-style:focus { border-color: #a78bfa; }
        .tab-btn { padding: 8px 18px; border-radius: 30px; border: none; cursor: pointer; font-family: 'Sarabun', sans-serif; font-size: 14px; font-weight: 600; transition: all 0.2s; }
        .type-btn { flex: 1; padding: 10px; border-radius: 10px; border: 2px solid transparent; cursor: pointer; font-family: 'Sarabun', sans-serif; font-weight: 600; font-size: 15px; transition: all 0.2s; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(167,139,250,0.4); border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "20px 20px 0" }}>
        <div style={{ fontFamily: "'Kanit', sans-serif", fontSize: 24, fontWeight: 800, background: "linear-gradient(90deg, #a78bfa, #38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 16 }}>
          💸 บัญชีส่วนตัว
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {TABS.map(t => (
            <button key={t} className="tab-btn" onClick={() => setTab(t)} style={{ background: tab === t ? "linear-gradient(135deg, #a78bfa, #7c3aed)" : "rgba(255,255,255,0.06)", color: tab === t ? "#fff" : "#aaa" }}>
              {t === "บันทึก" ? "✏️ " : t === "สรุป" ? "📊 " : "🎯 "}{t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px", maxWidth: 520, margin: "0 auto" }}>

        {/* ===== TAB: บันทึก ===== */}
        {tab === "บันทึก" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {editId && (
              <div style={{ background: "rgba(167,139,250,0.15)", border: "1px solid #a78bfa", borderRadius: 12, padding: "10px 16px", fontSize: 14, color: "#c4b5fd" }}>
                ✏️ กำลังแก้ไขรายการ — <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => { setEditId(null); setForm({ type: "expense", category: "food", amount: "", note: "", date: today() }); }}>ยกเลิก</span>
              </div>
            )}

            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                {["expense", "income"].map(tp => (
                  <button key={tp} className="type-btn" onClick={() => setForm(f => ({ ...f, type: tp, category: tp === "expense" ? "food" : "family" }))} style={{ background: form.type === tp ? (tp === "expense" ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)") : "rgba(255,255,255,0.04)", borderColor: form.type === tp ? (tp === "expense" ? "#ef4444" : "#22c55e") : "rgba(255,255,255,0.1)", color: form.type === tp ? (tp === "expense" ? "#ef4444" : "#22c55e") : "#aaa" }}>
                    {tp === "expense" ? "💸 รายจ่าย" : "💵 รายรับ"}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>หมวดหมู่</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {CATEGORIES[form.type].map(c => (
                    <button key={c.id} onClick={() => setForm(f => ({ ...f, category: c.id }))} style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${form.category === c.id ? c.color : "rgba(255,255,255,0.1)"}`, background: form.category === c.id ? `${c.color}22` : "transparent", color: form.category === c.id ? c.color : "#aaa", fontSize: 13, cursor: "pointer", fontFamily: "'Sarabun', sans-serif", transition: "all 0.15s" }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>จำนวนเงิน (บาท)</div>
                <input className="input-style" type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>รายละเอียด</div>
                <input className="input-style" placeholder="เช่น ข้าวกะเพรา, ค่า Grab, ซื้อของเข้าห้อง..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>วันที่</div>
                <input className="input-style" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>

              <button className="btn-primary" onClick={handleSubmit}>
                {editId ? "💾 บันทึกการแก้ไข" : "➕ เพิ่มรายการ"}
              </button>
            </div>

            <div>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 10, fontWeight: 600 }}>รายการล่าสุด</div>
              {transactions.slice(0, 30).map(t => {
                const cat = getCat(t.category);
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "12px 14px", marginBottom: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cat.color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                      {cat.label.split(" ")[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.note}</div>
                      <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{cat.label.split(" ").slice(1).join(" ")} · {t.date}</div>
                    </div>
                    <div style={{ color: t.type === "income" ? "#22c55e" : "#ef4444", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                      {t.type === "income" ? "+" : "-"}{fmt(t.amount)}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => handleEdit(t)} style={{ background: "rgba(167,139,250,0.15)", border: "none", borderRadius: 6, padding: "4px 8px", color: "#a78bfa", cursor: "pointer", fontSize: 12 }}>✏️</button>
                      <button onClick={() => handleDelete(t.id)} style={{ background: "rgba(239,68,68,0.15)", border: "none", borderRadius: 6, padding: "4px 8px", color: "#ef4444", cursor: "pointer", fontSize: 12 }}>🗑</button>
                    </div>
                  </div>
                );
              })}
              {transactions.length === 0 && <div style={{ textAlign: "center", color: "#555", padding: 30, fontSize: 14 }}>ยังไม่มีรายการ เริ่มบันทึกได้เลย!</div>}
            </div>
          </div>
        )}

        {/* ===== TAB: สรุป ===== */}
        {tab === "สรุป" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 6 }}>
              {PERIOD_TABS.map(p => (
                <button key={p} className="tab-btn" onClick={() => setPeriod(p)} style={{ flex: 1, background: period === p ? "linear-gradient(135deg, #a78bfa, #7c3aed)" : "transparent", color: period === p ? "#fff" : "#888", textAlign: "center" }}>
                  {p}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[{ label: "รายรับ", value: totalIncome, color: "#22c55e", icon: "📥" }, { label: "รายจ่าย", value: totalExpense, color: "#ef4444", icon: "📤" }].map(({ label, value, color, icon }) => (
                <div key={label} className="card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20 }}>{icon}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color, marginTop: 4 }}>{fmt(value)}</div>
                </div>
              ))}
            </div>

            <div className="card" style={{ textAlign: "center", background: balance >= 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", borderColor: balance >= 0 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)" }}>
              <div style={{ fontSize: 13, color: "#888" }}>ยอดคงเหลือ</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: balance >= 0 ? "#22c55e" : "#ef4444", fontFamily: "'Kanit', sans-serif", marginTop: 4 }}>
                {balance >= 0 ? "+" : ""}{fmt(balance)} บาท
              </div>
            </div>

            {expenseByCat.length > 0 && (
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontWeight: 600 }}>รายจ่ายตามหมวดหมู่</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["pie", "bar"].map(ct => (
                      <button key={ct} onClick={() => setChartType(ct)} style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", background: chartType === ct ? "rgba(167,139,250,0.2)" : "transparent", color: chartType === ct ? "#a78bfa" : "#666", cursor: "pointer", fontSize: 12, fontFamily: "'Sarabun',sans-serif" }}>
                        {ct === "pie" ? "🥧 วงกลม" : "📊 แท่ง"}
                      </button>
                    ))}
                  </div>
                </div>
                {chartType === "pie" ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={expenseByCat} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                          {expenseByCat.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `฿${fmt(v)}`} contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e8e8f0" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {expenseByCat.map(c => (
                        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                          <div style={{ flex: 1, fontSize: 13 }}>{c.label}</div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>฿{fmt(c.value)}</div>
                          <div style={{ fontSize: 11, color: "#888", minWidth: 36, textAlign: "right" }}>{totalExpense ? Math.round(c.value / totalExpense * 100) : 0}%</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={expenseByCat} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#888" }} tickFormatter={v => v.split(" ")[0]} />
                      <YAxis tick={{ fontSize: 10, fill: "#888" }} />
                      <Tooltip formatter={(v) => `฿${fmt(v)}`} contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e8e8f0" }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {expenseByCat.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {dailyData.length > 1 && (
              <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 16 }}>แนวโน้มรายวัน</div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={dailyData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#888" }} />
                    <Tooltip formatter={(v) => `฿${fmt(v)}`} contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e8e8f0" }} />
                    <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} dot={false} name="รายรับ" />
                    <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} dot={false} name="รายจ่าย" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {filtered.length === 0 && <div style={{ textAlign: "center", color: "#555", padding: 40 }}>ไม่มีข้อมูลในช่วงนี้</div>}
          </div>
        )}

        {/* ===== TAB: งบประมาณ ===== */}
        {tab === "งบประมาณ" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 4 }}>🎯 ตั้งงบประมาณรายเดือน</div>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>ตั้งวงเงินแต่ละหมวดสำหรับเดือนนี้</div>
              {CATEGORIES.expense.map(c => {
                const spent = monthlyExpenseByCat(c.id);
                const budget = budgets[c.id] || 0;
                const pct = budget ? Math.min(spent / budget * 100, 100) : 0;
                const over = budget && spent > budget;
                return (
                  <div key={c.id} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontSize: 14 }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: over ? "#ef4444" : "#888" }}>
                        ฿{fmt(spent)} {budget ? `/ ฿${fmt(budget)}` : ""}
                        {over && " ⚠️ เกินงบ!"}
                      </div>
                    </div>
                    {budget > 0 && (
                      <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 4, height: 6, marginBottom: 6 }}>
                        <div style={{ height: 6, borderRadius: 4, background: over ? "#ef4444" : c.color, width: `${pct}%`, transition: "width 0.5s" }} />
                      </div>
                    )}
                    <input className="input-style" type="number" placeholder={budget ? `ปัจจุบัน: ฿${fmt(budget)}` : "ตั้งงบ (บาท)"} style={{ fontSize: 13, padding: "8px 12px" }} value={budgetInput[c.id] || ""} onChange={e => setBudgetInput(prev => ({ ...prev, [c.id]: e.target.value }))} />
                  </div>
                );
              })}
              <button className="btn-primary" onClick={saveBudgets}>💾 บันทึกงบประมาณ</button>
            </div>

            {Object.keys(budgets).length > 0 && (
              <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 12 }}>ภาพรวมงบประมาณเดือนนี้</div>
                {CATEGORIES.expense.filter(c => budgets[c.id]).map(c => {
                  const spent = monthlyExpenseByCat(c.id);
                  const budget = budgets[c.id];
                  const remaining = budget - spent;
                  return (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                      <span>{c.label}</span>
                      <span style={{ color: remaining >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                        {remaining >= 0 ? `เหลือ ฿${fmt(remaining)}` : `เกิน ฿${fmt(Math.abs(remaining))}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
