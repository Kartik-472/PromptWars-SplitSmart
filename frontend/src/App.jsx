
import { useEffect, useState } from "react";
import {
  Wallet, Users, LayoutDashboard, Plus,
  ArrowUpRight, ArrowDownLeft, LogOut,
  Receipt, RefreshCw, CheckCircle2,
  TrendingUp, X, PieChart, Copy
} from "lucide-react";

import {
  ResponsiveContainer, PieChart as RePie,
  Pie, Cell, Tooltip
} from "recharts";

import api from "./services/api";

const money = amount =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR"
  }).format((amount || 0) / 100);

const COLORS = [
  "#8b5cf6", "#06b6d4", "#f59e0b",
  "#10b981", "#ec4899", "#64748b"
];

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [auth, setAuth] = useState({
    name: "",
    email: "",
    password: "",
    mode: "login"
  });

  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const [expense, setExpense] = useState({
    description: "",
    total: "",
    category: "Food",
    paidBy: "",
    splitType: "equal",
    participants: [],
    customAmounts: {},
    percentages: {}
  });

  async function request(action) {
    setError("");
    setNotice("");

    try {
      return await action();
    } catch (err) {
      const message =
        err.response?.data?.error ||
        "Something went wrong. Please try again.";

      setError(message);
      return null;
    }
  }

  async function login(e) {
    e.preventDefault();

    const endpoint = auth.mode === "login"
      ? "/auth/login"
      : "/auth/register";

    const payload = auth.mode === "login"
      ? { email: auth.email, password: auth.password }
      : auth;

    const response = await request(() =>
      api.post(endpoint, payload)
    );

    if (!response) return;

    localStorage.setItem(
      "splitsmart_token",
      response.data.token
    );

    setUser(response.data.user);
  }

  function logout() {
    localStorage.removeItem("splitsmart_token");
    setUser(null);
    setGroups([]);
    setActiveGroup(null);
    setPage("dashboard");
  }

  async function loadGroups() {
    const response = await request(() =>
      api.get("/groups")
    );

    if (response) setGroups(response.data.groups);
  }

  async function loadGroup(groupId) {
    setLoading(true);

    const [groupResponse, expenseResponse, balanceResponse,
      suggestionResponse] = await Promise.all([
        api.get(`/groups/${groupId}`),
        api.get(`/expenses/group/${groupId}`),
        api.get(`/expenses/group/${groupId}/balances`),
        api.get(`/settlements/${groupId}/suggestions`)
      ]);

    setActiveGroup({
      ...groupResponse.data.group,
      members: groupResponse.data.members
    });

    setExpenses(expenseResponse.data.expenses);
    setBalances(balanceResponse.data.balances);
    setSuggestions(suggestionResponse.data.suggestions);

    setLoading(false);
  }

  async function refresh() {
    if (activeGroup) {
      await loadGroup(activeGroup.id);
    }
    await loadGroups();
  }

  useEffect(() => {
    async function initialize() {
      const token = localStorage.getItem("splitsmart_token");

      if (!token) return;

      const response = await request(() =>
        api.get("/auth/me")
      );

      if (response) {
        setUser(response.data.user);
      } else {
        localStorage.removeItem("splitsmart_token");
      }
    }

    initialize();
  }, []);

  useEffect(() => {
    if (user) loadGroups();
  }, [user]);

  async function createGroup(e) {
    e.preventDefault();

    const response = await request(() =>
      api.post("/groups", { name: groupName })
    );

    if (!response) return;

    setGroupName("");
    setModal("");
    setNotice("Group created successfully.");
    await loadGroups();
    await openGroup(response.data.group.id);
  }

  async function joinGroup(e) {
    e.preventDefault();

    const response = await request(() =>
      api.post("/groups/join", { inviteCode })
    );

    if (!response) return;

    setInviteCode("");
    setModal("");
    setNotice("Successfully joined group.");
    await loadGroups();
  }

  async function openGroup(id) {
    const response = await request(() => loadGroup(id));

    if (response !== null) {
      setPage("group");
    }
  }

  function openExpenseModal() {
    if (!activeGroup) return;

    setExpense({
      description: "",
      total: "",
      category: "Food",
      paidBy: String(user.id),
      splitType: "equal",
      participants: activeGroup.members.map(m => m.id),
      customAmounts: {},
      percentages: {}
    });

    setModal("expense");
  }

  async function createExpense(e) {
    e.preventDefault();

    const total = Math.round(Number(expense.total) * 100);

    if (!Number.isSafeInteger(total) || total <= 0) {
      setError("Enter a valid expense amount.");
      return;
    }

    const participants = expense.participants.map(Number);

    if (!participants.length) {
      setError("Select at least one participant.");
      return;
    }

    let splits = participants.map(id => {
      if (expense.splitType === "custom") {
        return {
          userId: id,
          amount: Math.round(
            Number(expense.customAmounts[id] || 0) * 100
          )
        };
      }

      if (expense.splitType === "percentage") {
        return {
          userId: id,
          percentage: Number(expense.percentages[id] || 0)
        };
      }

      return { userId: id };
    });

    const response = await request(() =>
      api.post("/expenses", {
        groupId: activeGroup.id,
        description: expense.description,
        total,
        paidBy: Number(expense.paidBy),
        category: expense.category,
        splitType: expense.splitType,
        splits
      })
    );

    if (!response) return;

    setModal("");
    setNotice("Expense added successfully.");
    await refresh();
  }

  async function recordSettlement(item) {
    const response = await request(() =>
      api.post("/settlements", {
        groupId: activeGroup.id,
        receiverId: item.to,
        amount: item.amount
      })
    );

    if (response) {
      setNotice("Settlement request recorded. Waiting for receiver confirmation.");
      await refresh();
    }
  }

  async function confirmSettlement(id) {
    const response = await request(() =>
      api.post(`/settlements/${id}/confirm`)
    );

    if (response) {
      setNotice("Payment acknowledgement confirmed.");
      await refresh();
    }
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="brand-icon"><Wallet size={28} /></div>
          <h1>SplitSmart</h1>
          <p className="muted">
            Split expenses. Not friendships.
          </p>

          <form onSubmit={login}>
            {auth.mode === "register" && (
              <input
                placeholder="Full name"
                value={auth.name}
                onChange={e => setAuth({
                  ...auth, name: e.target.value
                })}
                required
              />
            )}

            <input
              type="email"
              placeholder="Email address"
              value={auth.email}
              onChange={e => setAuth({
                ...auth, email: e.target.value
              })}
              required
            />

            <input
              type="password"
              placeholder="Password (minimum 8 characters)"
              value={auth.password}
              onChange={e => setAuth({
                ...auth, password: e.target.value
              })}
              minLength={8}
              required
            />

            <button className="primary full">
              {auth.mode === "login"
                ? "Sign in"
                : "Create account"}
            </button>
          </form>

          {error && <p className="error">{error}</p>}

          <button
            className="text-button"
            onClick={() => setAuth({
              ...auth,
              mode: auth.mode === "login"
                ? "register" : "login"
            })}
          >
            {auth.mode === "login"
              ? "New here? Create an account"
              : "Already registered? Sign in"}
          </button>
        </div>
      </div>
    );
  }

  const myBalance = balances.find(
    b => b.user_id === user.id
  )?.balance || 0;

  const totalSpent = expenses.reduce(
    (sum, e) => sum + e.total_amount, 0
  );

  const categoryTotals = Object.values(
    expenses.reduce((acc, e) => {
      acc[e.category] ||= {
        name: e.category,
        value: 0
      };

      acc[e.category].value += e.total_amount / 100;

      return acc;
    }, {})
  );

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Wallet size={22} />
          </div>
          <span>SplitSmart</span>
        </div>

        <p className="nav-label">MENU</p>

        <button
          className={page === "dashboard" ? "nav active" : "nav"}
          onClick={() => {
            setPage("dashboard");
            setActiveGroup(null);
          }}
        >
          <LayoutDashboard size={19} />
          Dashboard
        </button>

        <button
          className={page === "groups" ? "nav active" : "nav"}
          onClick={() => setPage("groups")}
        >
          <Users size={19} />
          My Groups
        </button>

        <button
          className={page === "settlements" ? "nav active" : "nav"}
          onClick={() => setPage("settlements")}
        >
          <RefreshCw size={19} />
          Settlements
        </button>

        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">
              {user.name[0].toUpperCase()}
            </div>
            <div className="profile-info">
              <strong>{user.name}</strong>
              <small>Student account</small>
            </div>
            <button
              className="icon-button"
              onClick={logout}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="muted">Workspace / </span>
            <strong>
              {page === "group"
                ? activeGroup?.name
                : page === "dashboard"
                  ? "Overview"
                  : page === "groups"
                    ? "My Groups"
                    : "Settlements"}
            </strong>
          </div>

          <div className="top-actions">
            <span className="avatar small">
              {user.name[0].toUpperCase()}
            </span>
          </div>
        </header>

        {error && (
          <div className="alert error-box" role="alert">
            {error}
            <button onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}

        {notice && (
          <div className="alert success-box" role="status">
            {notice}
            <button onClick={() => setNotice("")}>
              <X size={16} />
            </button>
          </div>
        )}

        {page === "dashboard" && (
          <>
            <div className="page-heading">
              <div>
                <h1>Welcome back, {user.name.split(" ")[0]}!</h1>
                <p className="muted">
                  Here's your expense overview.
                </p>
              </div>

              <button
                className="primary"
                onClick={() => setModal("group")}
              >
                <Plus size={18} /> Create group
              </button>
            </div>

            <div className="stats-grid">
              <StatCard
                title="Your net balance"
                value={money(myBalance)}
                icon={<Wallet />}
                positive={myBalance >= 0}
              />
              <StatCard
                title="Groups joined"
                value={groups.length}
                icon={<Users />}
              />
              <StatCard
                title="Tracked group expenses"
                value={money(totalSpent)}
                icon={<Receipt />}
              />
            </div>

            <div className="content-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>My Groups</h2>
                    <p className="muted">Your active circles</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setPage("groups")}
                  >
                    View all
                  </button>
                </div>

                {groups.length === 0 ? (
                  <EmptyState
                    title="No groups yet"
                    text="Create a group to start sharing expenses."
                  />
                ) : groups.slice(0, 4).map(group => (
                  <button
                    className="group-row"
                    key={group.id}
                    onClick={() => openGroup(group.id)}
                  >
                    <div className="group-icon">
                      <Users />
                    </div>
                    <div className="group-details">
                      <strong>{group.name}</strong>
                      <small>{group.member_count} members</small>
                    </div>
                    <ArrowUpRight size={18} />
                  </button>
                ))}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Expense categories</h2>
                    <p className="muted">Selected group breakdown</p>
                  </div>
                  <PieChart size={19} />
                </div>

                {categoryTotals.length ? (
                  <>
                    <div style={{ height: 180 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RePie>
                          <Pie
                            data={categoryTotals}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={48}
                            outerRadius={75}
                          >
                            {categoryTotals.map((item, i) => (
                              <Cell
                                key={item.name}
                                fill={COLORS[i % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip formatter={v => `₹${v.toFixed(2)}`} />
                        </RePie>
                      </ResponsiveContainer>
                    </div>
                    {categoryTotals.map((item, i) => (
                      <div className="legend-row" key={item.name}>
                        <span>
                          <i style={{
                            background: COLORS[i % COLORS.length]
                          }} />
                          {item.name}
                        </span>
                        <strong>₹{item.value.toFixed(2)}</strong>
                      </div>
                    ))}
                  </>
                ) : (
                  <EmptyState
                    title="No expense data"
                    text="Open a group and add an expense."
                  />
                )}
              </section>
            </div>
          </>
        )}

        {page === "groups" && (
          <>
            <div className="page-heading">
              <div>
                <h1>My Groups</h1>
                <p className="muted">
                  Manage your shared expenses.
                </p>
              </div>
              <div className="button-row">
                <button
                  className="secondary"
                  onClick={() => setModal("join")}
                >
                  Join group
                </button>
                <button
                  className="primary"
                  onClick={() => setModal("group")}
                >
                  <Plus size={18} /> Create group
                </button>
              </div>
            </div>

            <div className="group-grid">
              {groups.map(group => (
                <button
                  className="group-card"
                  key={group.id}
                  onClick={() => openGroup(group.id)}
                >
                  <div className="group-icon large">
                    <Users size={23} />
                  </div>
                  <h3>{group.name}</h3>
                  <p className="muted">
                    {group.member_count} members
                  </p>
                  <div className="group-card-footer">
                    <span>Open group</span>
                    <ArrowUpRight size={18} />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {page === "group" && activeGroup && (
          <>
            <div className="page-heading">
              <div>
                <h1>{activeGroup.name}</h1>
                <p className="muted">
                  {activeGroup.members.length} group members
                </p>
              </div>

              <div className="button-row">
                <button
                  className="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      activeGroup.invite_code
                    );
                    setNotice("Invite code copied.");
                  }}
                >
                  <Copy size={17} /> Invite code
                </button>

                <button
                  className="primary"
                  onClick={openExpenseModal}
                >
                  <Plus size={18} /> Add expense
                </button>
              </div>
            </div>

            <div className="stats-grid">
              <StatCard
                title="Total group spending"
                value={money(totalSpent)}
                icon={<Receipt />}
              />
              <StatCard
                title="Group members"
                value={activeGroup.members.length}
                icon={<Users />}
              />
              <StatCard
                title="Your group balance"
                value={money(myBalance)}
                icon={<Wallet />}
                positive={myBalance >= 0}
              />
            </div>

            <div className="content-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Recent expenses</h2>
                </div>

                {expenses.length === 0 ? (
                  <EmptyState
                    title="No expenses"
                    text="Add your first shared expense."
                  />
                ) : expenses.map(e => (
                  <div className="expense-row" key={e.id}>
                    <div className="expense-icon">
                      <Receipt size={20} />
                    </div>
                    <div className="expense-info">
                      <strong>{e.description}</strong>
                      <small>
                        Paid by {e.payer_name} · {e.category}
                      </small>
                    </div>
                    <strong>{money(e.total_amount)}</strong>
                  </div>
                ))}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <h2>Group balances</h2>
                </div>

                {balances.map(b => (
                  <div className="balance-row" key={b.user_id}>
                    <div className="avatar">
                      {b.name[0].toUpperCase()}
                    </div>
                    <strong>
                      {b.name}
                      {b.user_id === user.id ? " (You)" : ""}
                    </strong>
                    <span className={
                      b.balance >= 0 ? "positive" : "negative"
                    }>
                      {b.balance >= 0 ? "+" : ""}
                      {money(b.balance)}
                    </span>
                  </div>
                ))}
              </section>
            </div>

            <section className="panel settlement-panel">
              <div className="panel-heading">
                <h2>Smart settlement suggestions</h2>
                <RefreshCw size={19} />
              </div>

              {suggestions.length === 0 ? (
                <p className="muted">Everyone is settled!</p>
              ) : suggestions.map((s, i) => (
                <div className="settlement-row" key={i}>
                  <div>
                    <strong>{s.fromName}</strong>
                    <span className="muted"> pays </span>
                    <strong>{s.toName}</strong>
                  </div>
                  <div className="button-row">
                    <strong>{money(s.amount)}</strong>
                    {s.from === user.id && (
                      <button
                        className="primary small-button"
                        onClick={() => recordSettlement(s)}
                      >
                        Record payment
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        {page === "settlements" && (
          <>
            <div className="page-heading">
              <div>
                <h1>Settlements</h1>
                <p className="muted">
                  Your pending payment acknowledgements.
                </p>
              </div>
            </div>

            {groups.map(g => (
              <SettlementGroup
                key={g.id}
                group={g}
                user={user}
                onConfirm={confirmSettlement}
                request={request}
              />
            ))}
          </>
        )}
      </main>

      {modal === "group" && (
        <Modal title="Create a group" close={() => setModal("")}>
          <form onSubmit={createGroup}>
            <label>Group name</label>
            <input
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="e.g. Hostel Roommates"
              maxLength={60}
              required
            />
            <button className="primary full">
              Create group
            </button>
          </form>
        </Modal>
      )}

      {modal === "join" && (
        <Modal title="Join a group" close={() => setModal("")}>
          <form onSubmit={joinGroup}>
            <label>Invitation code</label>
            <input
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              placeholder="Enter group code"
              required
            />
            <button className="primary full">
              Join group
            </button>
          </form>
        </Modal>
      )}

      {modal === "expense" && activeGroup && (
        <Modal title="Add an expense" close={() => setModal("")}>
          <form onSubmit={createExpense}>
            <label>Expense description</label>
            <input
              value={expense.description}
              onChange={e => setExpense({
                ...expense, description: e.target.value
              })}
              placeholder="e.g. Dinner"
              required
            />

            <label>Total amount (₹)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={expense.total}
              onChange={e => setExpense({
                ...expense, total: e.target.value
              })}
              placeholder="1000"
              required
            />

            <label>Category</label>
            <select
              value={expense.category}
              onChange={e => setExpense({
                ...expense, category: e.target.value
              })}
            >
              {["Food", "Groceries", "Travel", "Rent",
                "Utilities", "Entertainment", "Shopping", "Other"]
                .map(c => <option key={c}>{c}</option>)}
            </select>

            <label>Paid by</label>
            <select
              value={expense.paidBy}
              onChange={e => setExpense({
                ...expense, paidBy: e.target.value
              })}
            >
              {activeGroup.members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            <label>Split method</label>
            <select
              value={expense.splitType}
              onChange={e => setExpense({
                ...expense,
                splitType: e.target.value
              })}
            >
              <option value="equal">Split equally</option>
              <option value="custom">Custom amounts</option>
              <option value="percentage">Percentage split</option>
            </select>

            <label>Participants</label>

            {activeGroup.members.map(m => {
              const selected = expense.participants.includes(m.id);

              return (
                <div className="participant" key={m.id}>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={e => {
                        setExpense(old => ({
                          ...old,
                          participants: e.target.checked
                            ? [...old.participants, m.id]
                            : old.participants.filter(id => id !== m.id)
                        }));
                      }}
                    />
                    {m.name}
                  </label>

                  {selected && expense.splitType !== "equal" && (
                    <input
                      className="split-input"
                      type="number"
                      min="0"
                      step={expense.splitType === "custom" ? "0.01" : "1"}
                      placeholder={expense.splitType === "custom"
                        ? "Amount ₹" : "%"}
                      value={expense.splitType === "custom"
                        ? expense.customAmounts[m.id] ?? ""
                        : expense.percentages[m.id] ?? ""}
                      onChange={e => {
                        const key = expense.splitType === "custom"
                          ? "customAmounts" : "percentages";

                        setExpense(old => ({
                          ...old,
                          [key]: {
                            ...old[key],
                            [m.id]: e.target.value
                          }
                        }));
                      }}
                    />
                  )}
                </div>
              );
            })}

            <button className="primary full">
              Save expense
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, positive }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="muted">{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <h2 className={positive === undefined ? "" :
        positive ? "positive" : "negative"}>
        {value}
      </h2>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <Receipt size={27} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function Modal({ title, children, close }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => {
      if (e.target === e.currentTarget) close();
    }}>
      <div className="modal" role="dialog" aria-modal="true"
        aria-label={title}>
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button"
            onClick={close} aria-label="Close">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SettlementGroup({ group, user, onConfirm, request }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    request(() => api.get(`/settlements/${group.id}/suggestions`))
      .then(result => {
        if (result) setItems(result.data.suggestions);
      });
  }, [group.id]);

  return (
    <section className="panel">
      <h3>{group.name}</h3>
      {items.map((s, i) => (
        <div className="settlement-row" key={i}>
          <span>
            {s.fromName} pays {s.toName}
          </span>
          <strong>{money(s.amount)}</strong>
        </div>
      ))}
      <PendingPayments
        groupId={group.id}
        user={user}
        onConfirm={onConfirm}
      />
    </section>
  );
}

function PendingPayments({ groupId, user, onConfirm }) {
  const [pending, setPending] = useState([]);

  async function load() {
    try {
      const result = await api.get(
        `/settlements/history/${groupId}`
      );
      setPending(result.data.settlements);
    } catch {
      setPending([]);
    }
  }

  useEffect(() => { load(); }, [groupId]);

  return (
    <div>
      {pending.map(s => (
        <div className="settlement-row" key={s.id}>
          <span>
            {s.sender_name} → {s.receiver_name}
            {" · "}{money(s.amount)}
          </span>
          {s.status === "pending" &&
            s.receiver_id === user.id ? (
            <button
              className="primary small-button"
              onClick={() => onConfirm(s.id).then(load)}
            >
              Confirm received
            </button>
          ) : (
            <span className="muted">{s.status}</span>
          )}
        </div>
      ))}
    </div>
  );
}
