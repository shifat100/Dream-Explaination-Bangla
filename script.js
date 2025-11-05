

if (!Array.prototype.includes) {
    Array.prototype.includes = function (searchElement, fromIndex) {
        if (this == null) throw new TypeError('"this" is null or not defined');
        var o = Object(this);
        var len = o.length >>> 0;
        if (len === 0) return false;
        var n = fromIndex | 0;
        var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
        while (k < len) {
            if (o[k] === searchElement ||
                (typeof searchElement === 'number' && typeof o[k] === 'number' && isNaN(o[k]) && isNaN(searchElement))) {
                return true;
            }
            k++;
        }
        return false;
    };
}

var currentIndex = 0, currentPage = 0, pageSize = 10;
var mode = "list", data = [], filteredData = [], bookmarks = [], focusIndex = 0;
var dark = false, fontSize = 15;

var listView = document.getElementById("listView");
var articleView = document.getElementById("articleView");
var searchBar = document.getElementById("searchBar");
var searchInput = document.getElementById("searchInput");
var leftKey = document.getElementById("leftKey");
var centerKey = document.getElementById("centerKey");
var rightKey = document.getElementById("rightKey");
var articleTitle = document.getElementById("articleTitle");
var articleContent = document.getElementById("articleContent");
var loadingOverlay = document.getElementById("loadingOverlay");
var bookmarkBtn = document.getElementById("bookmarkBtn");
var pageIndicator = document.getElementById("pageIndicator");


bookmarkBtn.style.display = "none";


var dbName = "dreamAppDB";
var storeName = "dreamData";
var db;

function openDB(callback) {
    var request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = function (e) {
        db = e.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
        }
    };
    request.onsuccess = function (e) { db = e.target.result; callback(); };
    request.onerror = function (e) { console.error("DB error", e); callback(); };
}

function saveToDB(allData, callback) {
    var tx = db.transaction(storeName, "readwrite");
    var store = tx.objectStore(storeName);
    var clearReq = store.clear();
    clearReq.onsuccess = function () {
        allData.forEach(item => store.add(item));
    };
    tx.oncomplete = function () { if (callback) callback(); };
    tx.onerror = function (e) { console.error("Save error", e); if (callback) callback(); };
}

function loadFromDB(callback) {
    var tx = db.transaction(storeName, "readonly");
    var store = tx.objectStore(storeName);
    var all = [];
    store.openCursor().onsuccess = function (e) {
        var cursor = e.target.result;
        if (cursor) { all.push(cursor.value); cursor.continue(); }
        else { callback(all); }
    };
    tx.onerror = function (e) { console.error("Load error", e); callback([]); };
}


function loadAllFromJSON(callback) {
    var files = ["data1.json", "data2.json", "data3.json", "data4.json", "data5.json"];
    var loaded = 0;
    var allData = [];
    for (var i = 0; i < files.length; i++) {
        (function (f) {
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try { var arr = JSON.parse(xhr.responseText); allData = allData.concat(arr); } catch (e) { console.error("JSON parse error", e); }
                    } else {
                        console.warn("Could not load", f, "status:", xhr.status);
                    }
                    loaded++;
                    loadingOverlay.textContent = "Loading... " + Math.round((loaded / files.length) * 100) + "%";
                    if (loaded === files.length) {
                        loadingOverlay.style.display = "none";
                        saveToDB(allData, function () { data = allData; callback(); });
                    }
                }
            };
            xhr.open("GET", f, true); xhr.send();
        })(files[i]);
    }
}


openDB(function () {
    loadFromDB(function (dbData) {
        if (dbData.length > 0) {
            data = dbData;
            loadingOverlay.style.display = "none";
            renderList();
            searchInput.focus();
        } else {
            loadAllFromJSON(function () { renderList(); searchInput.focus(); });
        }
    });
});


function renderList(filter) {
    listView.innerHTML = "";
    filteredData = data;
    if (filter) {
        var q = filter.toLowerCase();
        filteredData = data.filter(x => (x.title || "").toLowerCase().includes(q) || (x.content || "").toLowerCase().includes(q));
    }

    var start = currentPage * pageSize;
    if (start >= filteredData.length && filteredData.length > 0) {
        currentPage = 0;
        start = 0;
    }
    var end = start + pageSize;
    var pageItems = filteredData.slice(start, end);

    for (var i = 0; i < pageItems.length; i++) {
        (function (item, idxInFiltered) {
            var div = document.createElement("div");
            div.className = "item";
            div.tabIndex = 0;
            div.textContent = item.title || "(কোন শিরোনাম নেই)";
            div.dataset.index = idxInFiltered;
            if (bookmarks.includes((item.title || "").toLowerCase())) div.classList.add("bookmarked");
            div.addEventListener("click", function () { showArticle(parseInt(this.dataset.index)); });
            div.addEventListener("keydown", function (e) {
                if (e.key === "Enter") showArticle(parseInt(this.dataset.index));
            });
            listView.appendChild(div);
        })(pageItems[i], start + i);
    }
    if (pageItems.length === 0) listView.innerHTML = "<p>কোন ফলাফল নেই</p>";

    var totalPages = Math.ceil(filteredData.length / pageSize);
    if (filteredData.length === 0) {
        pageIndicator.textContent = "পৃষ্ঠা 0/0";
    } else {
        pageIndicator.textContent = "পৃষ্ঠা " + (currentPage + 1) + "/" + totalPages;
    }

    focusItem(0);
    updateSoftkeys();
}

function focusItem(i) {
    var items = listView.querySelectorAll(".item");
    if (items.length === 0) return;

    if (i < 0) {
        if (currentPage > 0) {
            currentPage--;
            renderList(searchInput.value);
            return;
        }
        i = 0;
    }
    if (i >= items.length) {
        if ((currentPage + 1) * pageSize < filteredData.length) {
            currentPage++;
            renderList(searchInput.value);
            return;
        }
        i = items.length - 1;
    }

    currentIndex = i;
    try { items[i].focus(); } catch (err) { }
}


function openItem() {
    var items = listView.querySelectorAll(".item");
    if (items.length === 0) return;
    var idx = parseInt(items[currentIndex].dataset.index, 10);
    showArticle(idx);
}

function showArticle(idx) {
    articleView.scrollTop = 0;
    if (!Array.isArray(filteredData) || filteredData.length === 0) return;
    if (idx < 0) idx = 0;
    if (idx >= filteredData.length) idx = filteredData.length - 1;
    currentIndex = idx;
    var obj = filteredData[idx];

    articleTitle.textContent = obj.title || "(শিরোনাম নেই)";
    articleContent.innerHTML = obj.content || "";
    articleContent.style.fontSize = fontSize + "px";

    listView.style.display = "none";
    articleView.style.display = "block";
    searchBar.style.display = "none";
    bookmarkBtn.style.display = "inline-block";

    mode = "article";
    updateSoftkeys();
    updateBookmarkBtn();

    articleContent.scrollTop = 0;

    try { document.activeElement.blur(); } catch (e) { }
}

function backToList() {
    articleView.scrollTop = 0;
    articleView.style.display = "none";
    listView.style.display = "block";
    searchBar.style.display = "block";
    bookmarkBtn.style.display = "none";

    mode = "list";
    updateSoftkeys();
    renderList(searchInput.value);
    try { searchInput.focus(); } catch (e) { }
}

function toggleDark() {
    dark = !dark;
    if (dark) document.body.classList.add("dark");
    else document.body.classList.remove("dark");
}

function increase() { fontSize += 0.5; articleContent.style.fontSize = fontSize + "px"; }
function decrease() { fontSize = Math.max(10, fontSize - 0.5); articleContent.style.fontSize = fontSize + "px"; }

function toggleBookmark() {
    var title = articleTitle.textContent.trim().toLowerCase();
    if (!title) return;
    var idx = bookmarks.indexOf(title);
    if (idx >= 0) bookmarks.splice(idx, 1);
    else bookmarks.push(title);
    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
    updateBookmarkBtn();
    renderList(searchInput.value);
}

function updateBookmarkBtn() {
    var title = (articleTitle.textContent || "").trim().toLowerCase();
    bookmarkBtn.textContent = bookmarks.includes(title) ? "★" : "☆";
}

if (localStorage.getItem("bookmarks")) {
    try { bookmarks = JSON.parse(localStorage.getItem("bookmarks")); } catch (e) { bookmarks = []; }
}

function updateSoftkeys() {
    if (mode === "list") {
        rightKey.textContent = "Exit";
        centerKey.textContent = "Open";
        leftKey.textContent = "Search";
    } else if (mode === "article") {
        rightKey.textContent = "Back";
        centerKey.textContent = "Select";
        leftKey.textContent = "Dark";
    } else if (mode === "search") {
        rightKey.textContent = "";
        centerKey.textContent = "Done";
        leftKey.textContent = "";
    }
}


searchInput.oninput = function () {
    currentPage = 0;
    mode = "search";
    renderList(searchInput.value);
    updateSoftkeys();
    try { searchInput.focus(); } catch (e) { }
};


document.addEventListener("keydown", function (e) {
    var code = e.key;
    if (mode === "list") {
        if (code === "ArrowDown" || code === "8") { focusItem(currentIndex + 1); e.preventDefault(); }
        else if (code === "ArrowUp" || code === "2") { focusItem(currentIndex - 1); e.preventDefault(); }
        else if (code === "Enter") { openItem(); }
        else if (code === "SoftLeft" || code === "Escape" || code === "F1") { searchInput.focus(); mode = "search"; updateSoftkeys(); }
        else if (code === "SoftRight" || code === "F2") { window.close && window.close(); }
        window.addEventListener("back", (event) => {
            event.preventDefault();
            window.close && window.close();
        });
    } else if (mode === "article") {
        if (code === "ArrowUp") { articleView.scrollBy({ top: -80, behavior: 'smooth' }); e.preventDefault(); }
        else if (code === "ArrowDown") { articleView.scrollBy({ top: 80, behavior: 'smooth' }); e.preventDefault(); }
        if (code === "2") { articleView.scrollBy({ top: -200, behavior: 'smooth' }); e.preventDefault(); }
        else if (code === "8") { articleView.scrollBy({ top: 200, behavior: 'smooth' }); e.preventDefault(); }
        else if (code === "1") { decrease(); }
        else if (code === "3") { increase(); }
        else if (code === "5") { toggleBookmark(); }
        else if (code === "7") { articleView.scrollTop = 0; }
        else if (code === "9") { articleView.scrollTop = articleView.scrollHeight; }
        else if (code === "ArrowLeft" || code === "4") { showArticle(currentIndex - 1); articleView.scrollTop = 0; }
        else if (code === "ArrowRight" || code === "6") { showArticle(currentIndex + 1); articleView.scrollTop = 0; }
        else if (code === "SoftLeft" || code === "Escape" || code === "F1") { toggleDark(); }
        else if (code === "SoftRight" || code === "F2") { backToList(); }
        window.addEventListener("back", (event) => {
            event.preventDefault();
            backToList();
        });
    } else if (mode === "search") {
        if (code === "Enter") { mode = "list"; updateSoftkeys(); renderList(searchInput.value); }
    }
});


leftKey.addEventListener("click", function () {
    if (mode === "list") { searchInput.focus(); mode = "search"; updateSoftkeys(); }
    else if (mode === "article") { toggleDark(); }
    else if (mode === "search") { mode = "list"; updateSoftkeys(); renderList(); }
});
centerKey.addEventListener("click", function () {
    if (mode === "list") openItem();
    else if (mode === "article") { }
    else if (mode === "search") { mode = "list"; updateSoftkeys(); renderList(searchInput.value); }
});
rightKey.addEventListener("click", function () {
    if (mode === "list") window.close && window.close();
    else if (mode === "article") backToList();
    else if (mode === "search") { mode = "list"; updateSoftkeys(); renderList(); }
});

bookmarkBtn.addEventListener("click", toggleBookmark);