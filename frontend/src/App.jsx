
import { useCallback, useEffect, useMemo, useState } from "react";
import Auth from "./Auth";
import "./App.css";

const API_URL = "http://localhost:8080/api";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const initialForm = {
  title: "",
  amount: "",
  category: "Food",
  date: new Date().toISOString().slice(0, 10),
  type: "EXPENSE",
};

const categories = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Health",
  "Salary",
  "Other",
];

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("spendsense_token") || ""
  );
  const [email, setEmail] = useState(
    () => localStorage.getItem("spendsense_email") || ""
  );

  const [showAuth, setShowAuth] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [activeSection, setActiveSection] = useState("Overview");

  const signedIn = Boolean(token);

  const openAuth = (message = "") => {
    setAuthMessage(message);
    setShowAuth(true);
  };

  const signOut = () => {
    localStorage.removeItem("spendsense_token");
    localStorage.removeItem("spendsense_email");
    setToken("");
    setEmail("");
    setTransactions([]);
    setShowAuth(false);
    setEditingId(null);
    setForm(initialForm);
    setError("");
  };

  const apiRequest = useCallback(
    async (path, options = {}) => {
      if (!token) {
        openAuth("Sign in or create an account to use this feature.");
        throw new Error("Please sign in to continue.");
      }

      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      if (response.status === 401 || response.status === 403) {
        signOut();
        setAuthMessage("Your session expired. Please sign in again.");
        setShowAuth(true);
        throw new Error("Your session has expired. Please sign in again.");
      }

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Request failed (${response.status})`);
      }

      if (response.status === 204) return null;

      const text = await response.text();
      return text ? JSON.parse(text) : null;
    },
    [token]
  );

  const loadTransactions = useCallback(async () => {
    if (!token) {
      setTransactions([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/transactions");
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Could not load your transactions.");
    } finally {
      setLoading(false);
    }
  }, [token, apiRequest]);

  useEffect(() => {
    if (token) loadTransactions();
    else setTransactions([]);
  }, [token, loadTransactions]);

  const totals = useMemo(() => {
    const income = transactions
      .filter((item) => item.type === "INCOME")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const expenses = transactions
      .filter((item) => item.type === "EXPENSE")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return { income, expenses, balance: income - expenses };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return transactions.filter((item) => {
      const matchesSearch =
        !query ||
        String(item.title || "").toLowerCase().includes(query) ||
        String(item.category || "").toLowerCase().includes(query);

      const matchesType =
        filterType === "ALL" || item.type === filterType;

      return matchesSearch && matchesType;
    });
  }, [transactions, search, filterType]);

  const categoryTotals = useMemo(() => {
    const grouped = {};

    transactions
      .filter((item) => item.type === "EXPENSE")
      .forEach((item) => {
        const category = item.category || "Other";
        grouped[category] =
          (grouped[category] || 0) + Number(item.amount || 0);
      });

    return Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const monthlyTotals = useMemo(() => {
    const months = {};

    transactions.forEach((item) => {
      const date = new Date(`${item.date}T12:00:00`);
      if (Number.isNaN(date.getTime())) return;

      const key = date.toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit",
      });

      if (!months[key]) months[key] = { income: 0, expenses: 0 };

      if (item.type === "INCOME") {
        months[key].income += Number(item.amount || 0);
      } else {
        months[key].expenses += Number(item.amount || 0);
      }
    });

    return Object.entries(months).slice(-6);
  }, [transactions]);

  const requireAuth = (message) => {
    if (!token) {
      openAuth(message);
      return false;
    }
    return true;
  };

  const handleAuthenticated = (data) => {
    const newToken = data?.token;
    if (!newToken) {
      setAuthMessage("Authentication succeeded but no token was returned.");
      return;
    }

    localStorage.setItem("spendsense_token", newToken);
    localStorage.setItem("spendsense_email", data.email || "");
    setToken(newToken);
    setEmail(data.email || "");
    setShowAuth(false);
    setAuthMessage("");
    setError("");
  };

  const saveTransaction = async (event) => {
    event.preventDefault();
    if (!requireAuth("Sign in to add and manage transactions.")) return;

    const amount = Number(form.amount);
    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter a description and an amount greater than zero.");
      return;
    }

    const payload = {
      ...form,
      title: form.title.trim(),
      amount,
      type: form.type,
    };

    try {
      setError("");

      await apiRequest(
        editingId ? `/transactions/${editingId}` : "/transactions",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      setForm(initialForm);
      setEditingId(null);
      await loadTransactions();
      setActiveSection("Transactions");
    } catch (err) {
      setError(err.message || "Could not save transaction.");
    }
  };

  const editTransaction = (item) => {
    if (!requireAuth("Sign in to edit transactions.")) return;

    setEditingId(item.id);
    setForm({
      title: item.title || "",
      amount: String(item.amount ?? ""),
      category: item.category || "Other",
      date: item.date || initialForm.date,
      type: item.type || "EXPENSE",
    });
    setActiveSection("Add Transaction");
  };

  const deleteTransaction = async (id) => {
    if (!requireAuth("Sign in to delete transactions.")) return;
    if (!window.confirm("Delete this transaction?")) return;

    try {
      setError("");
      await apiRequest(`/transactions/${id}`, { method: "DELETE" });
      await loadTransactions();
    } catch (err) {
      setError(err.message || "Could not delete transaction.");
    }
  };

  const exportCSV = () => {
    if (!requireAuth("Sign in to export your financial data.")) return;

    const rows = [
      ["Title", "Amount", "Type", "Category", "Date"],
      ...transactions.map((item) => [
        item.title,
        item.amount,
        item.type,
        item.category,
        item.date,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "spendsense-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const navigate = (section) => {
    if (section !== "Overview" && !requireAuth("Sign in to access your financial dashboard.")) {
      return;
    }
    setActiveSection(section);
  };

  const maxMonthly = Math.max(
    1,
    ...monthlyTotals.flatMap(([, values]) => [
      values.income,
      values.expenses,
    ])
  );

  return (
    <div className="ss-app">
      <aside className="ss-sidebar">
        <div className="ss-brand">
          <div className="ss-brand-icon">₹</div>
          <div>
            <strong>spendsense</strong>
            <span>PERSONAL FINANCE</span>
          </div>
        </div>

        <p className="ss-nav-label">WORKSPACE</p>
        {["Overview", "Transactions", "Add Transaction", "Reports"].map(
          (section) => (
            <button
              key={section}
              className={`ss-nav-item ${
                activeSection === section ? "active" : ""
              }`}
              onClick={() => navigate(section)}
            >
              <span>
                {{
                  Overview: "◫",
                  Transactions: "↔",
                  "Add Transaction": "+",
                  Reports: "▥",
                }[section]}
              </span>
              {section}
              {!signedIn && section !== "Overview" && (
                <span className="ss-lock">⌑</span>
              )}
            </button>
          )
        )}

        <div className="ss-sidebar-bottom">
          <div className="ss-tip">
            <span>✦</span>
            <strong>Your money, clearer.</strong>
            <p>Understand your spending and make every rupee count.</p>
          </div>
          {signedIn ? (
            <button className="ss-account" onClick={signOut}>
              <span className="ss-avatar">
                {(email[0] || "U").toUpperCase()}
              </span>
              <span className="ss-account-text">
                <strong>{email || "Your account"}</strong>
                <small>Sign out</small>
              </span>
              <span>↗</span>
            </button>
          ) : (
            <button
              className="ss-account"
              onClick={() => openAuth("Sign in or create an account to get started.")}
            >
              <span className="ss-avatar">U</span>
              <span className="ss-account-text">
                <strong>Guest visitor</strong>
                <small>Sign in / Create account</small>
              </span>
              <span>→</span>
            </button>
          )}
        </div>
      </aside>

      <main className="ss-main">
        <header className="ss-topbar">
          <div>
            <span className="ss-breadcrumb">Workspace / </span>
            <strong>{activeSection}</strong>
          </div>
          <div className="ss-top-actions">
            <span className="ss-status">
              <span /> {signedIn ? "Your account" : "Preview mode"}
            </span>
            {signedIn ? (
              <button className="ss-primary small" onClick={() => navigate("Add Transaction")}>
                + Add transaction
              </button>
            ) : (
              <button className="ss-primary small" onClick={() => openAuth()}>
                Sign in / Sign up
              </button>
            )}
          </div>
        </header>

        <div className="ss-content">
          <section className="ss-heading">
            <div>
              <p className="ss-eyebrow">YOUR FINANCIAL OVERVIEW</p>
              <h1>
                {activeSection === "Overview"
                  ? "Money, in perspective."
                  : activeSection}
              </h1>
              <p className="ss-subtitle">
                {signedIn
                  ? "Here’s what’s happening with your money."
                  : "A clearer view of your money starts here."}
              </p>
            </div>
            {!signedIn && (
              <button className="ss-outline" onClick={() => openAuth()}>
                Get started <span>→</span>
              </button>
            )}
          </section>

          {error && <div className="ss-error">{error}</div>}

          {!signedIn && (
            <div className="ss-preview-note">
              <span>✦</span>
              <div>
                <strong>You’re viewing the public preview</strong>
                <p>
                  Sign in or create an account to see your own balances,
                  transactions, and reports.
                </p>
              </div>
              <button onClick={() => openAuth()}>Unlock dashboard →</button>
            </div>
          )}

          {activeSection === "Add Transaction" && (
            <section className="ss-panel ss-form-panel">
              <div className="ss-panel-heading">
                <div>
                  <h2>{editingId ? "Edit transaction" : "Add a transaction"}</h2>
                  <p>Keep your financial records up to date.</p>
                </div>
              </div>

              <form className="ss-form" onSubmit={saveTransaction}>
                <label>
                  Description
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Groceries"
                    required
                  />
                </label>

                <label>
                  Amount (₹)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </label>

                <label>
                  Type
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="EXPENSE">Expense</option>
                    <option value="INCOME">Income</option>
                  </select>
                </label>

                <label>
                  Category
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Date
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </label>

                <div className="ss-form-actions">
                  <button type="submit" className="ss-primary">
                    {editingId ? "Save changes" : "Add transaction"}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      className="ss-outline"
                      onClick={() => {
                        setEditingId(null);
                        setForm(initialForm);
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}

          {(activeSection === "Overview" || activeSection === "Reports") && (
            <>
              <section className="ss-metrics">
                <article className="ss-metric ss-balance">
                  <div className="ss-metric-top">
                    <span>NET BALANCE</span><span>↗</span>
                  </div>
                  <strong>{signedIn ? money(totals.balance) : "₹ — — —"}</strong>
                  <p>{signedIn ? "Income minus expenses" : "Your financial snapshot"}</p>
                  <div className="ss-balance-line" />
                </article>

                <article className="ss-metric">
                  <div className="ss-metric-top">
                    <span>TOTAL INCOME</span><span className="ss-icon-income">↙</span>
                  </div>
                  <strong>{signedIn ? money(totals.income) : "₹ — — —"}</strong>
                  <p>Money received</p>
                </article>

                <article className="ss-metric">
                  <div className="ss-metric-top">
                    <span>TOTAL EXPENSES</span><span className="ss-icon-expense">↗</span>
                  </div>
                  <strong>{signedIn ? money(totals.expenses) : "₹ — — —"}</strong>
                  <p>Money spent</p>
                </article>

                <article className="ss-metric">
                  <div className="ss-metric-top">
                    <span>TRANSACTIONS</span><span>≡</span>
                  </div>
                  <strong>{signedIn ? transactions.length : "—"}</strong>
                  <p>Recorded entries</p>
                </article>
              </section>

              <section className="ss-charts-grid">
                <article className="ss-panel">
                  <div className="ss-panel-heading">
                    <div>
                      <h2>Income vs expenses</h2>
                      <p>Monthly cash flow</p>
                    </div>
                    <span className="ss-period">Last 6 months</span>
                  </div>

                  {signedIn && monthlyTotals.length ? (
                    <div className="ss-chart">
                      <div className="ss-chart-legend">
                        <span><i className="income-dot" /> Income</span>
                        <span><i className="expense-dot" /> Expenses</span>
                      </div>
                      <div className="ss-bar-chart">
                        {monthlyTotals.map(([month, values]) => (
                          <div className="ss-bar-group" key={month}>
                            <div className="ss-bars">
                              <div
                                className="ss-bar income-bar"
                                style={{ height: `${Math.max(3, (values.income / maxMonthly) * 100)}%` }}
                                title={`Income: ${money(values.income)}`}
                              />
                              <div
                                className="ss-bar expense-bar"
                                style={{ height: `${Math.max(3, (values.expenses / maxMonthly) * 100)}%` }}
                                title={`Expenses: ${money(values.expenses)}`}
                              />
                            </div>
                            <small>{month}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="ss-chart-placeholder">
                      <div className="ss-placeholder-bars">
                        {[40, 65, 48, 82, 58, 72].map((height, index) => (
                          <div className="ss-placeholder-pair" key={index}>
                            <span style={{ height: `${height}%` }} />
                            <span style={{ height: `${Math.max(20, height - 22)}%` }} />
                          </div>
                        ))}
                      </div>
                      <p>
                        {signedIn
                          ? "Add transactions to build your monthly chart."
                          : "Your personal chart will appear after you sign in."}
                      </p>
                      {!signedIn && (
                        <button className="ss-text-button" onClick={() => openAuth()}>
                          Sign in to view your data →
                        </button>
                      )}
                    </div>
                  )}
                </article>

                <article className="ss-panel">
                  <div className="ss-panel-heading">
                    <div>
                      <h2>Spending by category</h2>
                      <p>Where your money goes</p>
                    </div>
                  </div>

                  {signedIn && categoryTotals.length ? (
                    <div className="ss-category-list">
                      {categoryTotals.slice(0, 6).map(([category, amount], index) => {
                        const percentage = totals.expenses
                          ? (amount / totals.expenses) * 100
                          : 0;
                        return (
                          <div className="ss-category-row" key={category}>
                            <div className="ss-category-label">
                              <span className={`ss-category-mark mark-${index % 5}`} />
                              <span>{category}</span>
                              <strong>{money(amount)}</strong>
                            </div>
                            <div className="ss-progress">
                              <span style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="ss-empty-chart">
                      <div className="ss-ring"><span>₹</span></div>
                      <p>
                        {signedIn
                          ? "Your spending categories will appear here."
                          : "Category insights are ready when you are."}
                      </p>
                      {!signedIn && (
                        <button className="ss-text-button" onClick={() => openAuth()}>
                          Get started →
                        </button>
                      )}
                    </div>
                  )}
                </article>
              </section>
            </>
          )}

          {(activeSection === "Overview" || activeSection === "Transactions") && (
            <section className="ss-panel ss-transactions-panel">
              <div className="ss-panel-heading ss-transaction-heading">
                <div>
                  <h2>Recent transactions</h2>
                  <p>
                    {signedIn
                      ? "Your latest financial activity"
                      : "Your activity will be private to your account"}
                  </p>
                </div>
                <div className="ss-table-actions">
                  {signedIn && (
                    <>
                      <input
                        className="ss-search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                        aria-label="Search transactions"
                      />
                      <select
                        className="ss-filter"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        aria-label="Filter transaction type"
                      >
                        <option value="ALL">All types</option>
                        <option value="INCOME">Income</option>
                        <option value="EXPENSE">Expenses</option>
                      </select>
                      <button className="ss-outline small" onClick={exportCSV}>
                        Export CSV
                      </button>
                    </>
                  )}
                </div>
              </div>

              {!signedIn ? (
                <div className="ss-private-state">
                  <span className="ss-private-icon">⌑</span>
                  <strong>Your transactions stay private</strong>
                  <p>Sign in or create an account to view and manage your financial activity.</p>
                  <button className="ss-primary" onClick={() => openAuth()}>
                    Sign in / Create account
                  </button>
                </div>
              ) : loading ? (
                <div className="ss-empty-state">Loading your transactions…</div>
              ) : filteredTransactions.length === 0 ? (
                <div className="ss-empty-state">
                  <span>↗</span>
                  <strong>No transactions found</strong>
                  <p>Add a transaction to start tracking your money.</p>
                  <button className="ss-primary" onClick={() => navigate("Add Transaction")}>
                    + Add transaction
                  </button>
                </div>
              ) : (
                <div className="ss-table-wrap">
                  <table className="ss-table">
                    <thead>
                      <tr>
                        <th>DESCRIPTION</th>
                        <th>CATEGORY</th>
                        <th>DATE</th>
                        <th>TYPE</th>
                        <th className="align-right">AMOUNT</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong className="ss-transaction-title">{item.title}</strong>
                          </td>
                          <td><span className="ss-category-pill">{item.category}</span></td>
                          <td>{item.date}</td>
                          <td>
                            <span className={`ss-type ${item.type === "INCOME" ? "type-income" : "type-expense"}`}>
                              {item.type === "INCOME" ? "Income" : "Expense"}
                            </span>
                          </td>
                          <td className={`align-right ss-amount ${item.type === "INCOME" ? "amount-income" : ""}`}>
                            {item.type === "INCOME" ? "+" : "−"}{money(item.amount)}
                          </td>
                          <td>
                            <div className="ss-row-actions">
                              <button onClick={() => editTransaction(item)} aria-label={`Edit ${item.title}`}>Edit</button>
                              <button onClick={() => deleteTransaction(item.id)} aria-label={`Delete ${item.title}`}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeSection === "Reports" && signedIn && (
            <section className="ss-panel ss-report-summary">
              <h2>Financial summary</h2>
              <div className="ss-report-row">
                <span>Total income</span><strong>{money(totals.income)}</strong>
              </div>
              <div className="ss-report-row">
                <span>Total expenses</span><strong>{money(totals.expenses)}</strong>
              </div>
              <div className="ss-report-row">
                <span>Net balance</span><strong>{money(totals.balance)}</strong>
              </div>
              <button className="ss-primary" onClick={exportCSV}>Export transactions to CSV</button>
            </section>
          )}

          <footer className="ss-footer">
            <span>SPENDSENSE © {new Date().getFullYear()}</span>
            <span>Built for a clearer relationship with money.</span>
          </footer>
        </div>
      </main>

      {showAuth && (
        <div
          className="ss-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowAuth(false);
          }}
        >
          <div className="ss-modal" role="dialog" aria-modal="true" aria-label="Sign in or create account">
            <button
              className="ss-modal-close"
              onClick={() => setShowAuth(false)}
              aria-label="Close authentication popup"
            >
              ×
            </button>
            {authMessage && <p className="ss-auth-message">{authMessage}</p>}
            <Auth onAuthenticated={handleAuthenticated} />
          </div>
        </div>
      )}
    </div>
  );
}
