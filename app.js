(() => {
  "use strict";

  const STORAGE_KEY = "toeic450.course.progress.v1";
  const REVIEW_GAPS = [1, 3, 7, 14];
  const el = (id) => document.getElementById(id);
  const refs = {
    loading: el("loadingState"), error: el("errorState"), errorMessage: el("errorMessage"),
    learning: el("learningView"), lookup: el("lookupView"), dayGroups: el("dayGroups"),
    daySelect: el("mobileDaySelect"), dayEyebrow: el("dayEyebrow"), dayTitle: el("dayTitle"),
    dayTopics: el("dayTopics"), dayStatus: el("dailyStatus"), dayBar: el("dailyBar"),
    tabs: el("studyTabs"), panel: el("studyPanel"), previous: el("previousDay"),
    next: el("nextDay"), globalProgress: el("globalProgress"), coursePercent: el("coursePercent"),
    courseBar: el("courseBar"), courseSummary: el("courseSummary"), bookmarkCount: el("bookmarkCount"),
    lookupTitle: el("lookupTitle"), lookupSummary: el("lookupSummary"), lookupInput: el("lookupInput"),
    lookupResults: el("lookupResults"), dialog: el("wordDialog"), dialogWord: el("dialogWord"),
    dialogDay: el("dialogDay"), dialogPos: el("dialogPos"), dialogIpa: el("dialogIpa"),
    dialogMeaning: el("dialogMeaning"), dialogExamples: el("dialogExamples"),
    dialogLearned: el("dialogLearned"), dialogBookmark: el("dialogBookmark"),
    dialogGoArticle: el("dialogGoArticle"), toast: el("toast"),
  };

  const stored = readStorage();
  const state = {
    vocabulary: [], articles: [], wordsById: new Map(), wordsByDay: new Map(),
    articlesByDay: new Map(), wordsByArticle: new Map(), articlesById: new Map(),
    selectedDay: dayFromHash() || validDay(stored.selectedDay) || 1,
    activeView: "article", articleIndex: 0, lookupMode: null, lookupQuery: "",
    openWordId: null, learned: new Set(stored.learned || []),
    bookmarks: new Set(stored.bookmarks || []), readArticles: new Set(stored.readArticles || []),
    translations: new Set(), reviewRevealed: new Set(), quizSelections: {}, quizChecked: new Set(),
  };
  let toastTimer = null;

  function readStorage() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch (_) { return {}; }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        selectedDay: state.selectedDay, learned: [...state.learned],
        bookmarks: [...state.bookmarks], readArticles: [...state.readArticles],
      }));
    } catch (_) { showToast("Không lưu được tiến độ trên thiết bị này."); }
  }

  function validDay(value) {
    const day = Number(value);
    return Number.isInteger(day) && day >= 1 && day <= 50 ? day : null;
  }

  function dayFromHash() {
    const match = location.hash.match(/^#ngay-(\d{1,2})$/);
    return match ? validDay(match[1]) : null;
  }

  function key(value) { return String(value); }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }
  function normalize(value) {
    return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi");
  }
  function pad(value) { return String(value).padStart(2, "0"); }
  function number(value) { return new Intl.NumberFormat("vi-VN").format(value); }
  function setWidth(element, numerator, denominator) {
    element.style.width = `${Math.min(100, denominator ? numerator / denominator * 100 : 0)}%`;
  }
  function articleWords(articleId) { return state.wordsByArticle.get(key(articleId)) || []; }
  function dayWords(day) { return state.wordsByDay.get(day) || []; }
  function dayArticles(day) { return state.articlesByDay.get(day) || []; }

  async function loadCourse() {
    refs.error.classList.add("hidden");
    refs.loading.classList.remove("hidden");
    try {
      let words;
      let articles;
      if (window.COLEARN_DATA) {
        ({ vocabulary: words, articles } = window.COLEARN_DATA);
      } else {
        const [wordsResponse, articlesResponse] = await Promise.all([
          fetch("./data/vocabulary.json"), fetch("./data/articles.json"),
        ]);
        if (!wordsResponse.ok || !articlesResponse.ok) throw new Error("Không tìm thấy dữ liệu khóa học.");
        [words, articles] = await Promise.all([wordsResponse.json(), articlesResponse.json()]);
      }
      if (!Array.isArray(words) || !Array.isArray(articles) || !words.length || !articles.length) {
        throw new Error("Dữ liệu khóa học chưa đầy đủ.");
      }
      state.vocabulary = words;
      state.articles = articles;
      state.wordsById.clear(); state.wordsByDay.clear(); state.wordsByArticle.clear();
      state.articlesByDay.clear(); state.articlesById.clear();
      words.forEach((word) => {
        state.wordsById.set(key(word.id), word);
        const day = Number(word.day);
        if (!state.wordsByDay.has(day)) state.wordsByDay.set(day, []);
        state.wordsByDay.get(day).push(word);
        const articleId = key(word.articleId);
        if (!state.wordsByArticle.has(articleId)) state.wordsByArticle.set(articleId, []);
        state.wordsByArticle.get(articleId).push(word);
      });
      articles.forEach((article) => {
        state.articlesById.set(key(article.id), article);
        const day = Number(article.day);
        if (!state.articlesByDay.has(day)) state.articlesByDay.set(day, []);
        state.articlesByDay.get(day).push(article);
      });
      for (const group of state.articlesByDay.values()) group.sort((a, b) => Number(a.id) - Number(b.id));
      state.learned = new Set([...state.learned].filter((id) => state.wordsById.has(id)));
      state.bookmarks = new Set([...state.bookmarks].filter((id) => state.wordsById.has(id)));
      state.readArticles = new Set([...state.readArticles].filter((id) => state.articlesById.has(id)));
      refs.loading.classList.add("hidden");
      refs.learning.classList.remove("hidden");
      renderEverything();
    } catch (error) {
      refs.loading.classList.add("hidden");
      refs.learning.classList.add("hidden");
      refs.lookup.classList.add("hidden");
      refs.error.classList.remove("hidden");
      refs.errorMessage.textContent = error.message || "Vui lòng thử lại sau ít phút.";
    }
  }

  function renderEverything() {
    renderProgress();
    renderDayNavigation();
    renderDay();
    if (state.lookupMode) renderLookup();
  }

  function renderProgress() {
    const totalTasks = state.vocabulary.length + state.articles.length;
    const doneTasks = state.learned.size + state.readArticles.size;
    const percentage = Math.round(doneTasks / totalTasks * 100) || 0;
    refs.globalProgress.textContent = `${number(state.learned.size)} / ${number(state.vocabulary.length)}`;
    refs.coursePercent.textContent = `${percentage}%`;
    refs.courseSummary.textContent = `${state.readArticles.size} / ${state.articles.length} bài đọc hoàn thành`;
    refs.bookmarkCount.textContent = number(state.bookmarks.size);
    setWidth(refs.courseBar, doneTasks, totalTasks);
  }

  function dayComplete(day) {
    const words = dayWords(day), articles = dayArticles(day);
    return words.length === 20 && articles.length === 2 &&
      words.every((word) => state.learned.has(key(word.id))) &&
      articles.every((article) => state.readArticles.has(key(article.id)));
  }

  function renderDayNavigation() {
    refs.dayGroups.innerHTML = "";
    refs.daySelect.innerHTML = "";
    for (let firstDay = 1; firstDay <= 50; firstDay += 5) {
      const group = document.createElement("section");
      group.className = "day-group";
      const title = document.createElement("h3");
      title.textContent = `Ngày ${pad(firstDay)}–${pad(firstDay + 4)}`;
      const grid = document.createElement("div");
      grid.className = "day-grid";
      for (let day = firstDay; day < firstDay + 5; day++) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `day-chip${day === state.selectedDay ? " selected" : ""}${dayComplete(day) ? " done" : ""}`;
        chip.dataset.day = String(day);
        chip.textContent = pad(day);
        chip.setAttribute("aria-label", `Ngày ${day}${dayComplete(day) ? ", đã hoàn thành" : ""}`);
        if (day === state.selectedDay) chip.setAttribute("aria-current", "step");
        grid.appendChild(chip);
      }
      group.append(title, grid);
      refs.dayGroups.appendChild(group);
    }
    for (let day = 1; day <= 50; day++) {
      const option = new Option(`Ngày ${pad(day)}${dayComplete(day) ? " ✓" : ""}`, String(day));
      refs.daySelect.appendChild(option);
    }
    refs.daySelect.value = String(state.selectedDay);
  }

  function renderDay() {
    const day = state.selectedDay;
    const articles = dayArticles(day);
    const words = dayWords(day);
    const done = words.filter((word) => state.learned.has(key(word.id))).length +
      articles.filter((article) => state.readArticles.has(key(article.id))).length;
    const total = words.length + articles.length;
    refs.dayEyebrow.textContent = `NGÀY ${pad(day)} / 50`;
    refs.dayTitle.textContent = `Ngày ${pad(day)}`;
    refs.dayTopics.textContent = articles.length === 2 ?
      `Mục tiêu: đọc “${articles[0].title}” và “${articles[1].title}”; ghi nhớ 20 từ trong ngữ cảnh.` :
      "Nội dung ngày học đang được cập nhật";
    refs.dayStatus.innerHTML = `<strong>${done} / ${total}</strong> đã hoàn thành`;
    setWidth(refs.dayBar, done, total);
    refs.previous.disabled = day === 1;
    refs.next.disabled = day === 50;
    refs.tabs.querySelectorAll(".study-tab").forEach((button) => {
      const active = button.dataset.view === state.activeView &&
        (state.activeView !== "article" || Number(button.dataset.articleIndex) === state.articleIndex);
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    renderPanel();
  }

  function selectDay(day, updateHash = true) {
    const next = validDay(day);
    if (!next) return;
    state.selectedDay = next;
    state.activeView = "article";
    state.articleIndex = 0;
    state.lookupMode = null;
    refs.lookup.classList.add("hidden");
    refs.learning.classList.remove("hidden");
    saveProgress();
    if (updateHash) history.replaceState(null, "", `#ngay-${next}`);
    renderDayNavigation();
    renderDay();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setTab(view, articleIndex = 0) {
    state.activeView = view;
    state.articleIndex = articleIndex;
    renderDay();
  }

  function renderPanel() {
    if (state.activeView === "vocabulary") renderVocabulary();
    else if (state.activeView === "review") renderReview();
    else renderArticle();
  }

  function showToast(message) {
    refs.toast.textContent = message;
    refs.toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => refs.toast.classList.remove("visible"), 3200);
  }

  function speak(text) {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      showToast("Trình duyệt này chưa hỗ trợ phát âm.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = "en-US";
    utterance.rate = 0.88;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase() === "en-us") ||
      voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) || null;
    if (!utterance.voice) showToast("Không có giọng Anh-Mỹ; đang dùng giọng mặc định của thiết bị.");
    utterance.onerror = () => showToast("Không phát được âm thanh. Hãy kiểm tra âm lượng hoặc thử trình duyệt khác.");
    window.speechSynthesis.speak(utterance);
  }

  function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function highlightedParagraph(text, words) {
    const paragraph = document.createElement("p");
    const terms = [...words].map((word) => word.word).filter(Boolean).sort((a, b) => b.length - a.length);
    if (!terms.length) { paragraph.textContent = text; return paragraph; }
    const lookup = new Map(words.map((word) => [word.word.toLocaleLowerCase("en"), word]));
    const regex = new RegExp(`(?<![A-Za-z])(${terms.map(escapeRegex).join("|")})(?![A-Za-z])`, "gi");
    let cursor = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > cursor) paragraph.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      const word = lookup.get(match[0].toLocaleLowerCase("en"));
      if (word) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "target-word";
        button.dataset.wordId = key(word.id);
        button.textContent = match[0];
        button.setAttribute("aria-label", `${match[0]}, nghe phát âm và xem nghĩa`);
        paragraph.appendChild(button);
      } else paragraph.appendChild(document.createTextNode(match[0]));
      cursor = regex.lastIndex;
    }
    if (cursor < text.length) paragraph.appendChild(document.createTextNode(text.slice(cursor)));
    return paragraph;
  }

  function addParagraphs(container, text, highlightWords = []) {
    const paragraphs = String(text || "").split(/\n\s*\n|\n/).filter(Boolean);
    paragraphs.forEach((part) => container.appendChild(highlightedParagraph(part.trim(), highlightWords)));
  }

  function renderArticle() {
    const article = dayArticles(state.selectedDay)[state.articleIndex];
    refs.panel.innerHTML = "";
    if (!article) {
      refs.panel.innerHTML = '<div class="empty-panel">Bài đọc này chưa có nội dung.</div>';
      return;
    }
    const words = articleWords(article.id);
    const layout = document.createElement("div");
    layout.className = "article-layout";
    const main = document.createElement("div");
    main.className = "article-main";
    const reading = document.createElement("article");
    reading.className = "reading-card";
    const wordCount = String(article.text || "").trim().split(/\s+/).filter(Boolean).length;
    const typeLabel = ({ story: "TÌNH HUỐNG", notice: "THÔNG BÁO", report: "BÁO CÁO", letter: "THƯ", email: "EMAIL", message: "TIN NHẮN", memo: "GHI NHỚ", article: "BÀI VIẾT", advice: "LỜI KHUYÊN", instructions: "HƯỚNG DẪN" })[String(article.type || "").toLowerCase()] || "BÀI ĐỌC";
    reading.innerHTML = `<div class="reading-head"><span class="reading-type">BÀI ĐỌC ${pad(article.id)} · ${typeLabel}</span><span class="reading-count">${wordCount} từ</span></div><h2>${escapeHtml(article.title)}</h2><div class="reading-copy"></div><div class="reading-actions"><button class="secondary-button" type="button" data-action="speak-article" data-article-id="${escapeHtml(article.id)}">Nghe bài đọc</button><button class="secondary-button" type="button" data-action="translation" data-article-id="${escapeHtml(article.id)}">${state.translations.has(key(article.id)) ? "Ẩn bản dịch" : "Xem bản dịch"}</button><button class="read-button ${state.readArticles.has(key(article.id)) ? "is-done" : ""}" type="button" data-action="read-article" data-article-id="${escapeHtml(article.id)}">${state.readArticles.has(key(article.id)) ? "✓ Đã đọc" : "Đánh dấu đã đọc"}</button></div>`;
    addParagraphs(reading.querySelector(".reading-copy"), article.text, words);
    if (state.translations.has(key(article.id))) {
      const translation = document.createElement("div");
      translation.className = "translation-panel";
      translation.innerHTML = "<h3>Bản dịch</h3>";
      addParagraphs(translation, article.translation);
      reading.appendChild(translation);
    }
    main.appendChild(reading);
    main.appendChild(renderQuestions(article));
    const aside = document.createElement("aside");
    aside.className = "article-words";
    aside.innerHTML = `<div class="article-words-head"><span class="eyebrow">TỪ CỦA BÀI</span><strong>${words.length} từ mới</strong></div>`;
    words.forEach((word) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preview-word";
      button.dataset.wordId = key(word.id);
      button.innerHTML = `<strong>${escapeHtml(word.word)}</strong><span>${escapeHtml(word.ipa || "")}</span><small>${escapeHtml(word.meaning)}</small>`;
      button.setAttribute("aria-label", `${word.word}, nghe phát âm và xem nghĩa`);
      aside.appendChild(button);
    });
    layout.append(main, aside);
    refs.panel.appendChild(layout);
  }

  function renderQuestions(article) {
    const section = document.createElement("section");
    section.className = "questions-card";
    const questions = Array.isArray(article.questions) ? article.questions : [];
    const checked = state.quizChecked.has(key(article.id));
    section.innerHTML = `<div class="section-heading"><div><span class="eyebrow">ĐỌC HIỂU</span><h3>Kiểm tra nhanh</h3></div><span>${questions.length} câu hỏi</span></div>`;
    const form = document.createElement("div");
    form.className = "questions-list";
    questions.forEach((question, index) => {
      const questionKey = `${key(article.id)}:${index}`;
      const selection = state.quizSelections[questionKey];
      const correct = Number(question.answerIndex);
      const fieldset = document.createElement("fieldset");
      fieldset.className = "question";
      const legend = document.createElement("legend");
      legend.textContent = `${index + 1}. ${question.question}`;
      fieldset.appendChild(legend);
      (question.options || []).forEach((option, optionIndex) => {
        const label = document.createElement("label");
        label.className = `answer-option${checked && optionIndex === correct ? " correct-answer" : ""}${checked && selection === optionIndex && selection !== correct ? " wrong-answer" : ""}`;
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `question-${article.id}-${index}`;
        radio.value = String(optionIndex);
        radio.dataset.questionArticle = key(article.id);
        radio.dataset.questionIndex = String(index);
        radio.checked = selection === optionIndex;
        const text = document.createElement("span");
        text.textContent = option;
        label.append(radio, text);
        fieldset.appendChild(label);
      });
      if (checked) {
        const feedback = document.createElement("p");
        feedback.className = `answer-feedback ${selection === correct ? "correct" : "incorrect"}`;
        feedback.textContent = selection === correct ? "Đúng rồi" : `Đáp án đúng: ${(question.options || [])[correct] || ""}`;
        fieldset.appendChild(feedback);
      }
      form.appendChild(fieldset);
    });
    section.appendChild(form);
    const footer = document.createElement("div");
    footer.className = "questions-footer";
    const button = document.createElement("button");
    button.className = "primary-button";
    button.type = "button";
    button.dataset.action = "check-quiz";
    button.dataset.articleId = key(article.id);
    button.textContent = checked ? "Kiểm tra lại" : "Kiểm tra đáp án";
    footer.appendChild(button);
    if (checked) {
      const score = questions.reduce((sum, question, index) =>
        sum + (state.quizSelections[`${key(article.id)}:${index}`] === Number(question.answerIndex) ? 1 : 0), 0);
      const result = document.createElement("strong");
      result.textContent = `Đúng ${score} / ${questions.length} câu`;
      footer.appendChild(result);
    }
    section.appendChild(footer);
    return section;
  }

  function renderVocabulary() {
    const words = dayWords(state.selectedDay);
    const learned = words.filter((word) => state.learned.has(key(word.id))).length;
    refs.panel.innerHTML = `<section class="vocabulary-panel"><div class="section-heading"><div><span class="eyebrow">NGÀY ${pad(state.selectedDay)}</span><h2>20 từ mới</h2></div><span>${learned} / ${words.length} từ đã học</span></div><p class="section-note">Chọn một từ để nghe phát âm, xem nghĩa và các câu ví dụ.</p><div class="vocabulary-groups"></div></section>`;
    const container = refs.panel.querySelector(".vocabulary-groups");
    dayArticles(state.selectedDay).forEach((article, index) => {
      const group = document.createElement("section");
      group.className = "vocabulary-group";
      group.innerHTML = `<h3>Bài ${index + 1}: ${escapeHtml(article.title)}</h3><div class="word-grid"></div>`;
      const grid = group.querySelector(".word-grid");
      articleWords(article.id).forEach((word) => grid.appendChild(wordCard(word)));
      container.appendChild(group);
    });
  }

  function wordCard(word) {
    const id = key(word.id);
    const card = document.createElement("div");
    card.className = `word-card${state.learned.has(id) ? " learned" : ""}`;
    const examples = (Array.isArray(word.examples) ? word.examples : []).map((example) =>
      `<div class="word-example"><p>${escapeHtml(example.en || "")}</p>${example.vi ? `<small>${escapeHtml(example.vi)}</small>` : ""}</div>`
    ).join("");
    card.innerHTML = `<div class="word-card-top"><button type="button" class="word-card-name" data-word-id="${escapeHtml(id)}"><strong>${escapeHtml(word.word)}</strong><small>${escapeHtml(word.ipa || "")}</small></button><button type="button" class="mini-icon-button" data-action="speak-word" data-word-id="${escapeHtml(id)}" aria-label="Nghe phát âm ${escapeHtml(word.word)}">♫</button></div><p>${escapeHtml(word.meaning)}</p><div class="word-example-controls"><button type="button" class="mini-text-button" data-action="toggle-examples" aria-expanded="false" aria-controls="word-examples-${escapeHtml(id)}">Show examples</button></div><div class="word-examples" id="word-examples-${escapeHtml(id)}" hidden>${examples || "<p>Chưa có câu ví dụ.</p>"}</div><div class="word-card-bottom"><span>${escapeHtml(word.pos || "")}</span><div><button type="button" class="mini-text-button" data-action="bookmark-word" data-word-id="${escapeHtml(id)}" aria-label="${state.bookmarks.has(id) ? "Bỏ lưu" : "Lưu"} từ ${escapeHtml(word.word)}">${state.bookmarks.has(id) ? "★ Đã lưu" : "☆ Lưu"}</button><button type="button" class="mini-text-button ${state.learned.has(id) ? "is-learned" : ""}" data-action="learn-word" data-word-id="${escapeHtml(id)}">${state.learned.has(id) ? "✓ Đã học" : "Đánh dấu học"}</button></div></div>`;
    return card;
  }

  function reviewWords(day) {
    const picked = [];
    REVIEW_GAPS.forEach((gap) => {
      const previousDay = day - gap;
      if (previousDay < 1) return;
      const available = dayWords(previousDay);
      if (!available.length) return;
      for (let index = 0; index < Math.min(4, available.length); index++) {
        picked.push({ word: available[(day + gap + index * 3) % available.length], fromDay: previousDay });
      }
    });
    return picked;
  }

  function renderReview() {
    const items = reviewWords(state.selectedDay);
    refs.panel.innerHTML = `<section class="review-panel"><div class="section-heading"><div><span class="eyebrow">ÔN TẬP NGẮT QUÃNG</span><h2>Nhớ lại từ cũ</h2></div><span>${items.length} từ</span></div><p class="section-note">Từ của các ngày trước được nhắc lại sau 1, 3, 7 và 14 ngày. Thử nhớ nghĩa trước khi mở đáp án.</p><div class="review-grid"></div></section>`;
    const grid = refs.panel.querySelector(".review-grid");
    if (!items.length) {
      grid.innerHTML = '<p class="empty-note">Ngày đầu chưa có từ cũ. Hãy bắt đầu với 20 từ mới và hai bài đọc.</p>';
      return;
    }
    items.forEach(({ word, fromDay }) => {
      const id = key(word.id);
      const revealed = state.reviewRevealed.has(id);
      const card = document.createElement("div");
      card.className = "review-card";
      card.innerHTML = `<span class="review-origin">NGÀY ${pad(fromDay)}</span><button type="button" class="review-word" data-word-id="${escapeHtml(id)}">${escapeHtml(word.word)}</button><span class="review-ipa">${escapeHtml(word.ipa || "")}</span><div class="review-reveal">${revealed ? `<strong>${escapeHtml(word.meaning)}</strong>` : `<button type="button" class="secondary-button" data-action="reveal-word" data-word-id="${escapeHtml(id)}">Hiện nghĩa</button>`}</div>`;
      grid.appendChild(card);
    });
  }

  function openLookup(mode) {
    state.lookupMode = mode;
    state.lookupQuery = "";
    refs.lookupInput.value = "";
    refs.learning.classList.add("hidden");
    refs.lookup.classList.remove("hidden");
    renderLookup();
    refs.lookupInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeLookup() {
    state.lookupMode = null;
    refs.lookup.classList.add("hidden");
    refs.learning.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderLookup() {
    const bookmarkMode = state.lookupMode === "bookmarks";
    refs.lookupTitle.textContent = bookmarkMode ? "Từ đã lưu" : "Tìm từ vựng";
    const query = normalize(state.lookupQuery.trim());
    refs.lookupResults.innerHTML = "";
    if (!bookmarkMode && !query) {
      refs.lookupSummary.textContent = `${number(state.vocabulary.length)} từ trong khóa học`;
      refs.lookupResults.innerHTML = '<div class="empty-panel">Nhập từ tiếng Anh hoặc nghĩa tiếng Việt để bắt đầu tìm.</div>';
      return;
    }
    const candidates = bookmarkMode ? state.vocabulary.filter((word) => state.bookmarks.has(key(word.id))) : state.vocabulary;
    const matches = query ? candidates.filter((word) =>
      normalize(word.word).includes(query) || normalize(word.meaning).includes(query)) : candidates;
    refs.lookupSummary.textContent = `${number(matches.length)} từ${bookmarkMode ? " đã lưu" : " phù hợp"}`;
    if (!matches.length) {
      refs.lookupResults.innerHTML = `<div class="empty-panel">${bookmarkMode && !query ? "Bạn chưa lưu từ nào. Hãy mở một từ và chọn Lưu từ." : "Không tìm thấy từ phù hợp. Hãy thử từ hoặc nghĩa khác."}</div>`;
      return;
    }
    const grid = document.createElement("div");
    grid.className = "word-grid lookup-grid";
    matches.slice(0, 80).forEach((word) => grid.appendChild(wordCard(word)));
    refs.lookupResults.appendChild(grid);
    if (matches.length > 80) {
      const note = document.createElement("p");
      note.className = "lookup-limit";
      note.textContent = "Đang hiển thị 80 từ đầu tiên. Nhập thêm chữ để thu hẹp kết quả.";
      refs.lookupResults.appendChild(note);
    }
  }

  function openWord(word) {
    if (!word) return;
    state.openWordId = key(word.id);
    refs.dialogDay.textContent = `NGÀY ${pad(word.day)} · BÀI ${pad(word.articleId)}`;
    refs.dialogWord.textContent = word.word;
    refs.dialogPos.textContent = word.pos || "";
    refs.dialogIpa.textContent = word.ipa || "";
    refs.dialogMeaning.textContent = word.meaning || "";
    refs.dialogExamples.innerHTML = "";
    (Array.isArray(word.examples) ? word.examples : []).forEach((example, index) => {
      const block = document.createElement("div");
      block.className = "example-block";
      block.innerHTML = `<span>${index + 1}</span><div><p class="example-en">${escapeHtml(example.en)}</p><p class="example-vi">${escapeHtml(example.vi)}</p></div>`;
      refs.dialogExamples.appendChild(block);
    });
    refs.dialogGoArticle.textContent = `Xem bài đọc ${pad(word.articleId)} của ngày ${pad(word.day)} →`;
    updateDialogActions();
    if (!refs.dialog.open) refs.dialog.showModal();
    speak(word.word);
  }

  function updateDialogActions() {
    const id = state.openWordId;
    if (!id) return;
    refs.dialogLearned.textContent = state.learned.has(id) ? "✓ Đã học · Bỏ đánh dấu" : "Đánh dấu đã học";
    refs.dialogBookmark.textContent = state.bookmarks.has(id) ? "★ Đã lưu · Bỏ lưu" : "☆ Lưu từ";
  }

  function toggleLearned(id) {
    if (!state.wordsById.has(id)) return;
    if (state.learned.has(id)) state.learned.delete(id);
    else state.learned.add(id);
    saveProgress();
    renderEverything();
    updateDialogActions();
  }

  function toggleBookmark(id) {
    if (!state.wordsById.has(id)) return;
    if (state.bookmarks.has(id)) state.bookmarks.delete(id);
    else state.bookmarks.add(id);
    saveProgress();
    renderEverything();
    updateDialogActions();
  }

  function toggleRead(id) {
    if (!state.articlesById.has(id)) return;
    if (state.readArticles.has(id)) state.readArticles.delete(id);
    else state.readArticles.add(id);
    saveProgress();
    renderEverything();
  }

  function handleAction(button) {
    const action = button.dataset.action;
    const wordId = button.dataset.wordId;
    const articleId = button.dataset.articleId;
    if (action === "speak-word") speak(state.wordsById.get(wordId)?.word || "");
    if (action === "learn-word") toggleLearned(wordId);
    if (action === "bookmark-word") toggleBookmark(wordId);
    if (action === "read-article") toggleRead(articleId);
    if (action === "speak-article") speak(state.articlesById.get(articleId)?.text || "");
    if (action === "translation") {
      if (state.translations.has(articleId)) state.translations.delete(articleId);
      else state.translations.add(articleId);
      renderArticle();
    }
    if (action === "check-quiz") {
      state.quizChecked.add(articleId);
      renderArticle();
    }
    if (action === "reveal-word") {
      state.reviewRevealed.add(wordId);
      renderReview();
    }
    if (action === "toggle-examples") {
      const examples = button.closest(".word-card")?.querySelector(".word-examples");
      if (!examples) return;
      examples.hidden = !examples.hidden;
      button.setAttribute("aria-expanded", String(!examples.hidden));
      button.textContent = examples.hidden ? "Show examples" : "Hide examples";
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const dayButton = target.closest("[data-day]");
    if (dayButton) { selectDay(dayButton.dataset.day); return; }
    const actionButton = target.closest("[data-action]");
    if (actionButton) { handleAction(actionButton); return; }
    const wordButton = target.closest("[data-word-id]");
    if (wordButton) openWord(state.wordsById.get(wordButton.dataset.wordId));
  });

  refs.tabs.addEventListener("click", (event) => {
    const button = event.target.closest(".study-tab");
    if (button) setTab(button.dataset.view, Number(button.dataset.articleIndex || 0));
  });
  refs.tabs.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...refs.tabs.querySelectorAll(".study-tab")];
    const current = tabs.indexOf(document.activeElement);
    let next = current;
    if (event.key === "ArrowLeft") next = (current + tabs.length - 1) % tabs.length;
    if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    tabs[next].focus();
    setTab(tabs[next].dataset.view, Number(tabs[next].dataset.articleIndex || 0));
  });
  refs.panel.addEventListener("change", (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.dataset.questionArticle) {
      state.quizSelections[`${input.dataset.questionArticle}:${input.dataset.questionIndex}`] = Number(input.value);
      if (state.quizChecked.has(input.dataset.questionArticle)) {
        state.quizChecked.delete(input.dataset.questionArticle);
        renderArticle();
      }
    }
  });
  refs.daySelect.addEventListener("change", () => selectDay(refs.daySelect.value));
  refs.previous.addEventListener("click", () => selectDay(state.selectedDay - 1));
  refs.next.addEventListener("click", () => selectDay(state.selectedDay + 1));
  el("searchButton").addEventListener("click", () => openLookup("search"));
  el("bookmarksButton").addEventListener("click", () => openLookup("bookmarks"));
  el("closeLookup").addEventListener("click", closeLookup);
  refs.lookupInput.addEventListener("input", () => {
    state.lookupQuery = refs.lookupInput.value;
    renderLookup();
  });
  el("retryButton").addEventListener("click", loadCourse);
  document.querySelector(".brand").addEventListener("click", (event) => {
    event.preventDefault();
    closeLookup();
  });
  el("closeWordDialog").addEventListener("click", () => refs.dialog.close());
  refs.dialog.addEventListener("click", (event) => { if (event.target === refs.dialog) refs.dialog.close(); });
  el("dialogSpeak").addEventListener("click", () => speak(state.wordsById.get(state.openWordId)?.word || ""));
  refs.dialogLearned.addEventListener("click", () => toggleLearned(state.openWordId));
  refs.dialogBookmark.addEventListener("click", () => toggleBookmark(state.openWordId));
  refs.dialogGoArticle.addEventListener("click", () => {
    const word = state.wordsById.get(state.openWordId);
    if (!word) return;
    refs.dialog.close();
    selectDay(word.day);
    const index = dayArticles(Number(word.day)).findIndex((article) => key(article.id) === key(word.articleId));
    setTab("article", Math.max(0, index));
  });
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
    if (event.key === "/" && !typing && !refs.dialog.open) {
      event.preventDefault();
      openLookup("search");
    }
    if (event.key === "Escape" && state.lookupMode && !refs.dialog.open) closeLookup();
  });
  window.addEventListener("hashchange", () => {
    const day = dayFromHash();
    if (day && day !== state.selectedDay) selectDay(day, false);
  });

  loadCourse();
})();
