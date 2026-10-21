import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  onValue,
  set,
  get
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";


const firebaseConfig = {
  apiKey: "AIzaSyD07eryO6orQkGNVt07NQJt55fZeGh2v6U",
  authDomain: "library-monitoring-syste-3b180.firebaseapp.com",
  databaseURL: "https://library-monitoring-syste-3b180-default-rtdb.firebaseio.com",
  projectId: "library-monitoring-syste-3b180",
  storageBucket: "library-monitoring-syste-3b180.firebasestorage.app",
  messagingSenderId: "858543380527",
  appId: "1:858543380527:web:c284f568cfa7a836bb4eda",
  measurementId: "G-EJZN41W8GQ"
};


const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getDatabase(firebaseApp);

const LIBRARY_PATH = "libraryData";
let databaseReady = false;
let stopDatabaseListener = null;

console.log("Firebase project:", firebaseConfig.projectId);
console.log("Firebase database URL:", firebaseConfig.databaseURL);
console.log("Library path:", LIBRARY_PATH);


const $ = id => document.getElementById(id);

const STORAGE_KEY = "qrLibraryData";

// Firebase is the shared source of truth. Local storage is only a local backup.
let data = { books: [], loans: [] };

function cleanData(value) {
  const safe = value && typeof value === "object" ? value : {};
  return {
    books: Array.isArray(safe.books) ? safe.books.map(book => ({
      id: book.id,
      title: book.title,
      category: book.category
    })) : [],
    loans: Array.isArray(safe.loans) ? safe.loans : []
  };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if (auth.currentUser && databaseReady) {
    set(ref(db, LIBRARY_PATH), data).catch(error => {
      console.error("Firebase save failed:", error);
      notify("Could not save to Firebase. Check your connection and database rules.");
    });
  }
}


function startSharedDatabase() {
  databaseReady = false;

  if (stopDatabaseListener) {
    stopDatabaseListener();
  }

  stopDatabaseListener = onValue(
    ref(db, LIBRARY_PATH),
    snapshot => {
      console.log("Firebase listener triggered");
      console.log("Database exists:", snapshot.exists());
      console.log("Current Firebase data:", snapshot.val());

      if (!snapshot.exists()) {
        console.log("Creating empty Firebase library...");

        set(ref(db, LIBRARY_PATH), {
  _initialized: true,
  books: [],
  loans: []
})
          .then(() => {
            console.log("Firebase initialization succeeded!");
            return get(ref(db, LIBRARY_PATH));
          })
          .then(snapshot => {
            console.log("Read-back path:", LIBRARY_PATH);
            console.log("Read-back exists:", snapshot.exists());
            console.log("Read-back data:", snapshot.val());
          })
          .catch(error => {
            console.error("Firebase initialization failed:", error);
            notify(
              "Could not initialize Firebase data. Check the database rules."
            );
          });

        return;
      }

      data = cleanData(snapshot.val());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      databaseReady = true;

      renderDashboard();
      renderBooks();
      populateBooks();
      renderActive();
      renderReturns();
      renderHistory();
    },
    error => {
      databaseReady = false;
      console.error("Firebase read failed:", error);
      notify(
        "Could not load shared data. Check Firebase Authentication and database rules."
      );
    }
  );
}


function notify(message) {
  const toast = $("toast");
  if (!toast) {
    alert(message);
    return;
  }
  toast.textContent = message;
  toast.style.display = "block";
  setTimeout(() => toast.style.display = "none", 2500);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
}

function getBook(id) {
  return data.books.find(book => book.id === id);
}

function available(book) {
  const currentlyBorrowed = data.loans.some(
    loan => loan.bookId === book.id && !loan.returnedAt
  );
  return currentlyBorrowed ? 0 : 1;
}

function showPage(page) {
  document.querySelectorAll(".page").forEach(el => {
    el.classList.add("hidden");
  });

  const section = $(page);
  if (!section) return;

  section.classList.remove("hidden");

  document.querySelectorAll(".nav[data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  const titles = {
    dashboard: "Dashboard",
    books: "Books",
    borrow: "Borrow Item",
    active: "Active Borrowings",
    returns: "Return Book",
    history: "Borrowing History"
  };

  $("pageTitle").textContent = titles[page] || "Dashboard";

  if (page === "dashboard") renderDashboard();
  if (page === "books") renderBooks();
  if (page === "borrow") populateBooks();
  if (page === "active") renderActive();
  if (page === "returns") renderReturns();
  if (page === "history") renderHistory();
}
// LOGIN WITH FIREBASE AUTHENTICATION
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  $("loginError").textContent = "Signing in...";
  try {
    await signInWithEmailAndPassword(
      auth,
      $("username").value.trim(),
      $("password").value
    );
    $("loginError").textContent = "";
  } catch (error) {
    console.error("Firebase sign-in failed:", error);
    $("loginError").textContent = "Sign-in failed. Check your email and password, then try again.";
  }
});

// LOGOUT
$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign-out failed:", error);
    notify("Could not sign out. Please try again.");
  }
});

// Keep the page state in sync with Firebase Authentication.
onAuthStateChanged(auth, user => {
  if (user) {
    console.log("Signed-in Firebase UID:", user.uid); 
    $("loginPage").classList.add("hidden");
    $("app").classList.remove("hidden");
    $("password").value = "";
    startSharedDatabase();
    showPage("dashboard");
  } else {
    databaseReady = false;
    if (stopDatabaseListener) {
      stopDatabaseListener();
      stopDatabaseListener = null;
    }
    $("app").classList.add("hidden");
    $("loginPage").classList.remove("hidden");
    $("password").value = "";
  }
});

// NAVIGATION
document.querySelectorAll(".nav[data-page]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.go));
});

// TABLE HELPER
function makeTable(headers, rows) {
  if (!rows.length) return '<div class="empty">No records found.</div>';

  return `<div class="table-wrap"><table>
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table></div>`;
}

// DASHBOARD
function renderDashboard() {
  // Count titles, not physical copies.
  $("totalBooks").textContent = data.books.length;

  $("returnedCount").textContent =
    data.loans.filter(l => l.returnedAt).length;

  const activeBorrowings = data.loans.filter(
  loan => !loan.returnedAt
).length;

const activeCountElement = document.getElementById("activeCount");

if (activeCountElement) {
  activeCountElement.textContent = activeBorrowings;
}

  const recent = [...data.loans]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  $("recentTransactions").innerHTML = makeTable(
    ["Transaction", "Student", "Book", "Date", "Status"],
    recent.map(l => `<tr>
      <td>${escapeHTML(l.id)}</td>
      <td>${escapeHTML(l.student)}</td>
      <td>${escapeHTML(getBook(l.bookId)?.title || "Unknown book")}</td>
      <td>${escapeHTML(l.createdAt)}</td>
      <td><span class="status ${l.returnedAt ? "" : "out"}">
        ${l.returnedAt ? "Returned" : "Borrowed"}
      </span></td>
    </tr>`)
  );
}

// BOOK INVENTORY
function renderBooks() {
  const query = $("bookSearch").value.toLowerCase();

  const books = data.books.filter(b =>
    [b.id, b.title, b.category]
      .some(v => String(v || "").toLowerCase().includes(query))
  );

  $("booksTable").innerHTML = makeTable(
    ["Book ID", "Title", "Category", "Status", "Actions"],
    books.map(b => `<tr>
      <td>${escapeHTML(b.id)}</td>
      <td>${escapeHTML(b.title)}</td>
      <td>${escapeHTML(b.category)}</td>
      <td>${available(b) ? "Available" : "Borrowed"}</td>
      <td>
        <button class="action" data-action="edit" data-id="${escapeHTML(b.id)}">Edit</button>
        <button class="action" data-action="qr" data-id="${escapeHTML(b.id)}">QR</button>
      </td>
    </tr>`)
  );
}

$("addBookBtn").addEventListener("click", () => {
  $("bookForm").reset();
  $("editBookId").value = "";
  $("bookFormTitle").textContent = "Add New Book";
  $("bookFormPanel").classList.remove("hidden");
  $("qrPanel").classList.add("hidden");
});

$("cancelBook").addEventListener("click", () => {
  $("bookFormPanel").classList.add("hidden");
});

$("bookForm").addEventListener("submit", event => {
  event.preventDefault();

  const id = $("editBookId").value;
  const existing = id ? getBook(id) : null;

  const details = {
    title: $("bookTitle").value.trim(),
    category: $("bookCategory").value.trim()
  };

  if (existing) {
    Object.assign(existing, details);
  } else {
    data.books.push({
      id: "BK-" + Date.now().toString().slice(-8),
      ...details
    });
  }

  saveData();
  $("bookFormPanel").classList.add("hidden");
  renderBooks();
  renderDashboard();
  populateBooks();
  notify("Book information saved.");
});

// BOOK EDITING AND QR GENERATION
$("booksTable").addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const book = getBook(button.dataset.id);
  if (!book) return;

  if (button.dataset.action === "edit") {
    $("editBookId").value = book.id;
    $("bookTitle").value = book.title;
    $("bookCategory").value = book.category;
    $("bookFormTitle").textContent = "Edit Book";
    $("bookFormPanel").classList.remove("hidden");
  }

  if (button.dataset.action === "qr") {
    $("qrPanel").classList.remove("hidden");
    $("qrBookName").textContent = `${book.title} (${book.id})`;
    $("qrCode").innerHTML = "";

    if (typeof QRCode === "undefined") {
      notify("QR library unavailable. Check your internet connection.");
      return;
    }

    new QRCode($("qrCode"), {
      text: book.id,
      width: 190,
      height: 190
    });
  }
});

// PRINT QR
$("printQR").addEventListener("click", () => {
  const code = $("qrCode").querySelector("canvas, img");
  if (!code) return notify("Generate a QR code first.");

  const image = code.tagName === "CANVAS" ? code.toDataURL() : code.src;
  const win = window.open("", "_blank");

  if (!win) return notify("Please allow pop-ups to print.");

  win.document.write(`
    <html><body style="text-align:center;font-family:Arial">
      <h2>${escapeHTML($("qrBookName").textContent)}</h2>
      <img src="${image}" width="190">
      <script>window.onload=()=>window.print();<\/script>
    </body></html>
  `);
  win.document.close();
});

// BORROWING
function populateBooks() {
  const select = $("borrowBook");
  const previous = select.value;

  select.innerHTML = '<option value="">Select a book</option>' +
    data.books.filter(b => available(b) > 0).map(b =>
      `<option value="${escapeHTML(b.id)}">${escapeHTML(b.title)}</option>`
    ).join("");

  if (data.books.some(b => b.id === previous && available(b) > 0)) {
    select.value = previous;
  }
}

$("dueDate").min = new Date().toISOString().slice(0, 10);

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

$("dueDate").value = defaultDueDate();

$("borrowQr").addEventListener("change", () => {
  const book = getBook($("borrowQr").value.trim());

  if (book) {
    $("borrowBook").value = book.id;
    notify("Book identified: " + book.title);
  } else if ($("borrowQr").value.trim()) {
    notify("Book QR ID not found.");
  }
});

$("borrowForm").addEventListener("submit", event => {
  event.preventDefault();

  const book = getBook($("borrowBook").value);
  if (!book || available(book) < 1) {
    notify("This book is unavailable.");
    populateBooks();
    return;
  }

  const qr = $("borrowQr").value.trim();
  if (qr && qr !== book.id) {
    notify("The QR code does not match the selected book.");
    return;
  }

  const dueDate = $("dueDate").value;
  const today = new Date().toISOString().slice(0, 10);

  if (!dueDate || dueDate < today) {
    notify("Please select a valid due date.");
    return;
  }

  const studentId = $("studentId").value.trim();

  if (data.loans.some(l =>
    l.studentId.toLowerCase() === studentId.toLowerCase() &&
    l.bookId === book.id && !l.returnedAt
  )) {
    notify("This student already borrowed this book.");
    return;
  }

  if (!confirm(
    `Confirm borrowing?\nBook: ${book.title}\nStudent: ${$("student").value}\nStudent ID: ${studentId}`
  )) return;

  data.loans.push({
    id: "TX-" + Date.now().toString().slice(-8),
    bookId: book.id,
    student: $("student").value.trim(),
    studentId,
    grade: $("grade").value,
    section: $("section").value.trim(),
    createdAt: today,
    dueDate,
    returnedAt: null
  });

  saveData();
  $("borrowForm").reset();
  $("dueDate").value = defaultDueDate();

  renderDashboard();
  populateBooks();
  showPage("active");
  notify("Borrowing recorded successfully.");
});

// ACTIVE BORROWINGS
function renderActive() {
  const query = $("activeSearch").value.toLowerCase();

  const loans = data.loans.filter(l => {
    const book = getBook(l.bookId);
    return !l.returnedAt &&
      [l.id, l.student, l.studentId, l.grade, l.section, book?.title]
        .some(v => String(v || "").toLowerCase().includes(query));
  });

  $("activeTable").innerHTML = makeTable(
    ["Transaction", "Student", "Grade / Section", "Book", "Borrowed", "Due"],
    loans.map(l => `<tr>
      <td>${escapeHTML(l.id)}</td>
      <td>${escapeHTML(l.student)}</td>
      <td>${escapeHTML(l.grade)} - ${escapeHTML(l.section)}</td>
      <td>${escapeHTML(getBook(l.bookId)?.title || "Unknown book")}</td>
      <td>${escapeHTML(l.createdAt)}</td>
      <td>${escapeHTML(l.dueDate)}</td>
    </tr>`)
  );
}

// RETURN BOOK
function renderReturns() {
  const query = $("returnSearch").value.toLowerCase();

  const loans = data.loans.filter(l => {
    const book = getBook(l.bookId);
    return !l.returnedAt &&
      [l.id, l.student, l.studentId, book?.title]
        .some(v => String(v || "").toLowerCase().includes(query));
  });

  $("returnTable").innerHTML = makeTable(
    ["Transaction", "Student", "Book", "Due Date", "Action"],
    loans.map(l => `<tr>
      <td>${escapeHTML(l.id)}</td>
      <td>${escapeHTML(l.student)}<br>${escapeHTML(l.studentId)}</td>
      <td>${escapeHTML(getBook(l.bookId)?.title || "Unknown book")}</td>
      <td>${escapeHTML(l.dueDate)}</td>
      <td><button class="primary" data-action="return" data-id="${escapeHTML(l.id)}">Confirm Return</button></td>
    </tr>`)
  );
}

$("returnTable").addEventListener("click", event => {
  const button = event.target.closest('[data-action="return"]');
  if (!button) return;

  const loan = data.loans.find(l =>
    l.id === button.dataset.id && !l.returnedAt
  );

  if (!loan) return notify("This book has already been returned.");

  if (!confirm(`Confirm return of ${getBook(loan.bookId)?.title || loan.bookId} from ${loan.student}?`)) {
    return;
  }

  loan.returnedAt = new Date().toISOString().slice(0, 10);
  saveData();

  renderReturns();
  renderActive();
  renderHistory();
  renderDashboard();
  populateBooks();

  notify("Book returned successfully.");
});

// BORROWING HISTORY
function renderHistory() {
  const query = $("historySearch").value.toLowerCase();

  const loans = [...data.loans]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter(l => {
      const book = getBook(l.bookId);
      return [l.id, l.student, l.studentId, l.grade, l.section, book?.title]
        .some(v => String(v || "").toLowerCase().includes(query));
    });

  $("historyTable").innerHTML = makeTable(
    ["Transaction", "Student", "Grade / Section", "Book", "Borrowed", "Returned", "Status"],
    loans.map(l => `<tr>
      <td>${escapeHTML(l.id)}</td>
      <td>${escapeHTML(l.student)}<br>${escapeHTML(l.studentId)}</td>
      <td>${escapeHTML(l.grade)} - ${escapeHTML(l.section)}</td>
      <td>${escapeHTML(getBook(l.bookId)?.title || "Unknown book")}</td>
      <td>${escapeHTML(l.createdAt)}</td>
      <td>${escapeHTML(l.returnedAt || "—")}</td>
      <td><span class="status ${l.returnedAt ? "" : "out"}">${l.returnedAt ? "Returned" : "Borrowed"}</span></td>
    </tr>`)
  );
}

// SEARCH
[
  ["bookSearch", renderBooks],
  ["activeSearch", renderActive],
  ["returnSearch", renderReturns],
  ["historySearch", renderHistory]
].forEach(([id, callback]) => {
  $(id).addEventListener("input", callback);
});

// QR CAMERA SCANNING
let scanner = null;

async function stopScanner() {
  if (scanner) {
    try {
      if (scanner.isScanning) await scanner.stop();
      await scanner.clear();
    } catch (error) {
      console.warn(error);
    }
    scanner = null;
  }

  $("scanner").classList.add("hidden");
}

$("scanBorrow").addEventListener("click", async () => {
  if (typeof Html5Qrcode === "undefined") {
    notify("QR scanner library unavailable.");
    return;
  }

  $("scanner").classList.remove("hidden");
  $("scanner").innerHTML = "";

  try {
    scanner = new Html5Qrcode("scanner");

    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 220 },
      async decodedText => {
        $("borrowQr").value = decodedText.trim();

      const book = getBook(decodedText.trim());

      if (book) {
      $("borrowBook").value = book.id;

      const status = available(book)
    ? "Available"
    : "Currently borrowed";

  notify(
    "Scanned: " + book.title +
    " | Category: " + book.category +
    " | Status: " + status
  );
} else {
  notify("QR code not found in the inventory.");
}

        await stopScanner();
      },
      () => {}
    );
  } catch (error) {
    await stopScanner();
    notify("Camera access failed. Use Live Server and allow camera access.");
    console.error(error);
  }
});

$("clearHistoryBtn").addEventListener("click", () => {
  const returnedCount = data.loans.filter(
    loan => loan.returnedAt
  ).length;

  if (returnedCount === 0) {
    notify("There are no completed records to clear.");
    return;
  }

  const confirmed = confirm(
    `Are you sure you want to clear ${returnedCount} completed borrowing record(s)?\n\n` +
    "Active borrowings will NOT be deleted. This action cannot be undone."
  );

  if (!confirmed) {
    notify("Clear history cancelled.");
    return;
  }

  // Keep active borrowings; remove completed records only.
  data.loans = data.loans.filter(loan => !loan.returnedAt);

  saveData();

  renderHistory();
  renderDashboard();
  renderActive();
  renderReturns();
  populateBooks();

  notify("Completed borrowing history cleared.");
});

// INITIALIZE
renderDashboard();
renderBooks();
populateBooks();

console.log("Library application loaded.");