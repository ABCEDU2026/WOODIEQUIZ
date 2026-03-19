document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // =========================================================================
    // A90 QUIZ ENGINE - STABLE REWRITTEN EDITION
    // - Tái biên soạn toàn bộ app.js
    // - Giữ đầy đủ chức năng gốc của A80
    // - Bổ sung A90 Learning Engine: smart quiz + retry wrong questions
    // =========================================================================

    // -------------------------------------------------------------------------
    // 1. CONFIG
    // -------------------------------------------------------------------------
    const STORAGE_KEYS = {
        ALL_USERS_DB_KEY: 'quizAppUsers_A80_Stable',
        LAST_USER_KEY: 'quizAppLastUser_A80',
        LAST_TOPIC_KEY: 'quizAppLastTopic_A80'
    };

    const DATABASE_FILES = [
        'lichsudiali.json',
        'khoahoctunhien.json',
        'GDCD.json',
        'toan6.json',
        'toanvip.json',
        'nguvan6.json',
        'ENGLISHHK1.json',
        'CIE6TW6.json',
        'IEL90.json',
        'questiontest.json',
        '2000W.json',
    ];

    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyoztj_qCAVbFQhSlj4U0IHrZZwEWlkHQ4NR9VandMGvKw8G4fhhQCuazqPBCr013Ut/exec';
    const AI_GURU_URL = 'https://still-fog-44ed.phungtriduc.workers.dev/';
    const AUTO_ADVANCE_DELAY = 1500;
    const SPEECH_PASS_THRESHOLD = 70;
    const NON_AUTO_ADVANCE_TYPES = ['noi', 'nhieu_dap_an', 'sap_xep', 'phan_loai', 'dropdown'];

    const LEVELS = [
        { score: 0, name: 'Tân binh 🔰' },
        { score: 50, name: 'Học trò 🧑‍🎓' },
        { score: 150, name: 'Học giả 📚' },
        { score: 300, name: 'Thông thái 🧠' },
        { score: 500, name: 'Giáo sư 🧑‍🏫' },
        { score: 1000, name: 'Hiền triết 🏛️' }
    ];

    const SLOGAN_LIBRARY = [
        '🚀 Kiến thức là sức mạnh - Level up your brain!',
        '🌱 Mỗi ngày học một chút, tương lai sáng ngời.',
        '🔥 Sai thì sửa, đừng ngại thử thách!',
        '🧠 Nâng cấp bộ não, bão tố cũng qua!'
    ];

    // -------------------------------------------------------------------------
    // 2. STATE
    // -------------------------------------------------------------------------
    const state = {
        currentUserName: '',
        allUsersData: {},
        allTopics: [],
        activeQuestions: [],
        currentQuestionIndex: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        lifetimeCorrect: 0,
        currentMode: '',
        isReviewMode: false,
        currentQuizTitle: '',
        seenQuestionIds: {},
        quizTimer: null,
        quizSeconds: 0,
        autoAdvanceTimeout: null,
        quizStartTime: null,
        hasQuizEnded: false,
        eliteVoices: [],
        learning: {
            currentPoolType: 'normal'
        },
        matchingState: {
            selectedLeft: null,
            userMatches: {}
        },
        categorizationState: {
            draggingTag: null
        },
        speech: {
            recognition: null,
            isRecognitionActive: false,
            isProcessingSpeechResult: false
        }
    };

    // -------------------------------------------------------------------------
    // 3. DOM
    // -------------------------------------------------------------------------
    const $ = (id) => document.getElementById(id);

    const dom = {
        appHeader: $('app-header'),
        startScreen: $('start-screen'),
        quizScreen: $('quiz-screen'),
        subjectSelector: $('subject-selector'),
        topicSelector: $('topic-selector'),
        topicTotalQuestions: $('topic-total-questions'),
        questionText: $('question-text'),
        optionsContainer: $('options-container'),
        explanationBox: $('explanation-box'),
        explanationText: $('explanation-text'),
        readingPassageContainer: $('reading-passage-container'),
        navigationControls: $('navigation-controls'),
        nextQuestionBtn: $('next-question-btn'),
        prevQuestionBtn: $('prev-question-btn'),
        stopQuizBtn: $('stop-quiz-btn'),
        askAiBtn: $('ask-ai-btn'),
        aiResponseArea: $('ai-response-area'),
        aiContentText: $('ai-content-text'),
        dashboardHeader: $('dashboard-header'),
        questionCounter: $('question-counter'),
        questionNavGrid: $('question-nav-grid'),
        resultsModal: $('results-modal'),
        victoryModal: $('victory-modal'),
        nameInput: $('name-input'),
        slogan: $('daily-slogan'),
        mobileSubmitBtn: $('mobile-submit-btn'),
        mobileTimer: $('mob-timer'),
        mobileProgress: $('mob-progress'),
        dashboardTimer: $('timer-value'),
        progressBar: $('progress-bar'),
        correctValue: $('correct-value'),
        incorrectValue: $('incorrect-value'),
        accuracyValue: $('accuracy-value'),
        scoreValue: $('score-value'),
        dashboardCup: $('dash-cup'),
        dashboardLevel: $('dash-level'),
        userLogList: $('user-log-list'),
        leaderboardList: $('leaderboard-list'),
        welcomeUser: $('welcome-user'),
        welcomePrompt: $('welcome-prompt'),
        userSignature: $('user-signature'),
        startScreenLevel: $('start-screen-level'),
        startScreenCups: $('start-screen-cups'),
        reportStartDate: $('report-start-date'),
        reportEndDate: $('report-end-date'),
        finalScore: $('final-score'),
        finalAccuracy: $('final-accuracy'),
        finalCorrect: $('final-correct'),
        finalTotal: $('final-total'),
        victoryScore: $('victory-score')
    };

    let submitQuizBtn = $('submit-quiz-btn');
    if (!submitQuizBtn && dom.navigationControls) {
        submitQuizBtn = document.createElement('button');
        submitQuizBtn.id = 'submit-quiz-btn';
        submitQuizBtn.textContent = 'NỘP BÀI';
        submitQuizBtn.className = 'nav-btn primary';
        submitQuizBtn.style.display = 'none';
        submitQuizBtn.style.backgroundColor = '#f59e0b';
        submitQuizBtn.style.color = 'white';
        dom.navigationControls.insertBefore(submitQuizBtn, dom.stopQuizBtn);
    }

    const sounds = {
        correct: $('sound-correct'),
        incorrect: $('sound-incorrect'),
        start: $('sound-start'),
        victory: $('sound-victory')
    };

    // -------------------------------------------------------------------------
    // 4. UTILITIES
    // -------------------------------------------------------------------------
    function normalizeString(str) {
        return str ? str.toString().trim().toLowerCase().replace(/\s+/g, ' ') : '';
    }
// ================= IELTS SPEAKING ENGINE =================
const IELTS_CONFIG = {
    maxAttempts: 3,
    slowRate: 0.75
};

function evaluateSpeakingIELTS(userSpeech, correctText) {
    const similarity = calculateSimilarity(userSpeech, correctText);

    const userWords = normalizeString(userSpeech).split(' ');
    const correctWords = normalizeString(correctText).split(' ');

    let match = 0;
    correctWords.forEach(w => {
        if (userWords.includes(w)) match++;
    });

    const coverage = correctWords.length ? match / correctWords.length : 0;

    let score = similarity * 0.5 + coverage * 50;

    if (userWords.length >= correctWords.length * 0.8) {
        score += 20;
    }

    const band = Math.min(9, (score / 100) * 9).toFixed(1);

    return { similarity, coverage, band };
}

    function shuffleArray(array) {
        const arr = Array.isArray(array) ? [...array] : [];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function safeJsonParse(value, fallback) {
        try {
            return JSON.parse(value);
        } catch (_) {
            return fallback;
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function fixMalformedSVG(htmlString) {
        if (!htmlString || typeof htmlString !== 'string') return '';
        if (!htmlString.includes('<svg')) return htmlString;
        return htmlString
            .replace(/viewBox=([\d\s\.-]+)/g, 'viewBox="$1"')
            .replace(/points=([\d,\s\.-]+)/g, 'points="$1"')
            .replace(/width=(\d+)/g, 'width="$1"')
            .replace(/height=(\d+)/g, 'height="$1"')
            .replace(/xmlns=([^\s>]+)/g, 'xmlns="$1"')
            .replace(/style=([^"'>]+)/g, 'style="$1"');
    }

    function calculateSimilarity(str1, str2) {
        const s1 = normalizeString(str1);
        const s2 = normalizeString(str2);
        if (s1 === s2) return 100;
        const words1 = s1.split(' ').filter(Boolean);
        const words2 = s2.split(' ').filter(Boolean);
        if (!words1.length || !words2.length) return 0;
        let matches = 0;
        words1.forEach(word => {
            if (words2.includes(word)) matches++;
        });
        return Math.round((matches / Math.max(words1.length, words2.length)) * 100);
    }

    function calculateLevel(score) {
        let level = LEVELS[0].name;
        for (let i = LEVELS.length - 1; i >= 0; i--) {
            if (score >= LEVELS[i].score) {
                level = LEVELS[i].name;
                break;
            }
        }
        return level;
    }

    function playSound(sound, volume = 1) {
        if (!sound) return;
        try {
            sound.currentTime = 0;
            sound.volume = volume;
            sound.play().catch(() => {});
        } catch (_) {}
    }

    function showAlert(message) {
        window.alert(message);
    }

    function showConfirm(message) {
        return window.confirm(message);
    }

    function randomizeSlogan() {
        if (!dom.slogan) return;
        const slogan = SLOGAN_LIBRARY[Math.floor(Math.random() * SLOGAN_LIBRARY.length)];
        dom.slogan.textContent = `"${slogan}"`;
    }

    function stopAllTTS() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }

    function resetAIPanel() {
        if (dom.aiResponseArea) dom.aiResponseArea.classList.add('hidden');
        if (dom.aiContentText) dom.aiContentText.innerHTML = '';
    }

    function showExplanation(question) {
        dom.explanationBox.classList.remove('hidden');
        const expText = question.explanation ? fixMalformedSVG(question.explanation) : 'Không có giải thích chi tiết.';
        dom.explanationText.innerHTML = expText;
    }

    function syncMobileDashboard() {
        if (dom.mobileTimer && dom.dashboardTimer) {
            dom.mobileTimer.textContent = dom.dashboardTimer.textContent || '00:00';
        }
        if (dom.mobileProgress) {
            dom.mobileProgress.textContent = `${state.currentQuestionIndex + 1}/${state.activeQuestions.length || 0}`;
        }
    }

    function ensureUserLearningData(userData) {
        if (!userData.wrongQuestionIdsByTopic) userData.wrongQuestionIdsByTopic = {};
        if (!userData.mistakeFrequency) userData.mistakeFrequency = {};
        if (!userData.lastWrongQuestions) userData.lastWrongQuestions = [];
        return userData;
    }

    function getCurrentTopicKey(subjectValue, topicValue) {
        if (!subjectValue) return 'unknown';
        if (subjectValue.startsWith('comprehensive_')) return subjectValue;
        const topic = state.allTopics[topicValue];
        return topic ? `${topic.subject}::${topic.name}` : 'unknown';
    }

    function isQuestionAnsweredCorrectly(question) {
        if (!question) return false;

        if (question.type === 'dien_khuyet') {
            return normalizeString(question.userAnswer) === normalizeString(question.answer);
        }

        if (Array.isArray(question.answer)) {
            return JSON.stringify((question.userAnswer || []).slice().sort()) === JSON.stringify((question.answer || []).slice().sort());
        }

        if (question.type === 'speaking') {
            return question.isAnswered === true && question._isCorrect === true;
        }

        return question.userAnswer === question.answer;
    }

    function createUserSkeleton() {
        return ensureUserLearningData({
            cupCount: 0,
            lifetimeCorrect: 0,
            topicResults: [],
            seenQuestionIds: {}
        });
    }


// ================= MIC VISUALIZER =================
let audioContext = null;
let analyser = null;
let dataArray = null;
let source = null;
let stream = null;
let animationFrameId = null;

async function initMicVisualizer() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Browser không hỗ trợ microphone');
        }

        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;

        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        dataArray = new Uint8Array(analyser.frequencyBinCount);

        return true;
    } catch (err) {
        console.error('Mic init error:', err);
        alert('Không thể truy cập microphone');
        return false;
    }
}

function drawWaveform() {
    const canvas = document.getElementById('waveform');
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    // Thu nhỏ chiều cao canvas để trông gọn hơn
    canvas.height = 50; 

    function draw() {
        animationFrameId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Tạo dải màu từ Tím sang Hồng rực rỡ
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, '#6366f1'); // Tím
        gradient.addColorStop(0.5, '#ec4899'); // Hồng
        gradient.addColorStop(1, '#8b5cf6'); // Tím nhạt

        const barWidth = (canvas.width / dataArray.length) * 2.5;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height;
            
            ctx.fillStyle = gradient;
            // Vẽ thanh bo góc tròn cho mượt mà
            ctx.beginPath();
            ctx.roundRect(x, canvas.height - barHeight, barWidth - 2, barHeight, 5);
            ctx.fill();

            x += barWidth;
        }
    }
    draw();
}

function stopMicVisualizer() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    analyser = null;
    dataArray = null;
}

    // -------------------------------------------------------------------------
    // 5. SPEECH / TTS
    // -------------------------------------------------------------------------
    function loadEliteVoices() {
        if ('speechSynthesis' in window) {
            state.eliteVoices = window.speechSynthesis.getVoices();
        }
    }

    if ('speechSynthesis' in window && speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadEliteVoices;
    }
    loadEliteVoices();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    function initSpeechRecognition() {
        if (!SpeechRecognition) {
            console.error('🔴 Browser Warning: Trình duyệt này không hỗ trợ Web Speech API.');
            return null;
        }
        const rec = new SpeechRecognition();
        rec.lang = 'en-US';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        rec.continuous = false;
        return rec;
    }

    state.speech.recognition = initSpeechRecognition();

    function playNativeAudio(text) {
        if (!('speechSynthesis' in window)) {
            showAlert('Trình duyệt của bạn không hỗ trợ tính năng đọc AI. Hãy thử dùng Chrome, Edge hoặc Safari bản mới nhất.');
            return;
        }
        if (!text) return;

        stopAllTTS();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        if (state.eliteVoices.length === 0) loadEliteVoices();

        const bestVoice =
            state.eliteVoices.find(v => v.name.includes('Natural') && v.lang.includes('en')) ||
            state.eliteVoices.find(v => v.name.includes('Google US English')) ||
            state.eliteVoices.find(v => v.name.includes('Samantha') && v.lang === 'en-US') ||
            state.eliteVoices.find(v => v.name.includes('Daniel') && v.lang === 'en-GB') ||
            state.eliteVoices.find(v => v.lang === 'en-US' || v.lang === 'en-GB');

        if (bestVoice) utterance.voice = bestVoice;
        window.speechSynthesis.speak(utterance);
    }
function playSlow(text) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.7;
    u.lang = 'en-US';
    speechSynthesis.speak(u);
}

    // -------------------------------------------------------------------------
    // 6. DATA LOADING
    // -------------------------------------------------------------------------
    async function loadAndParseAllTopics() {
        state.allTopics = [];

        const fetchPromises = DATABASE_FILES.map(file =>
            fetch(file)
                .then(res => {
                    if (!res.ok) throw new Error(`Không thể truy cập: ${file}`);
                    return res.json();
                })
                .catch(err => {
                    console.error(`🔴 A90 Error Boundary: ${err.message}`);
                    return null;
                })
        );

        const results = await Promise.all(fetchPromises);

        results.filter(Boolean).forEach(jsonData => {
            if (!Array.isArray(jsonData)) return;

            jsonData.forEach(topicObj => {
                const rawQuestions = Array.isArray(topicObj.questions) ? topicObj.questions : [];
                const questions = rawQuestions.map((q, index) => ({
                    ...q,
                    id: q.id || `${(topicObj.topic || 'topic').replace(/\s/g, '_')}-${index}`,
                    userAnswer: null,
                    isAnswered: false,
                    _isCorrect: null,
                    leftCol: Array.isArray(q.leftCol) ? q.leftCol : [],
                    rightCol: Array.isArray(q.rightCol) ? q.rightCol : []
                }));

                state.allTopics.push({
                    name: topicObj.topic || 'Untitled',
                    subject: topicObj.subject || 'General',
                    questions,
                    originalIndex: state.allTopics.length
                });
            });
        });
    }

    function prepareQuestionData(question) {
        if (!question) return {};
        const q = deepClone(question);
        q.options = q.options && typeof q.options === 'object' ? q.options : {};
        q._isCorrect = null;

        if (q.type === 'mot_dap_an' || q.type === 'listening') {
            const keys = Object.keys(q.options);
            const shuffledKeys = shuffleArray(keys);
            const originalCorrectContent = q.options[q.answer];
            const shuffledContentMap = {};
            ['a', 'b', 'c', 'd'].forEach((newKey, index) => {
                if (shuffledKeys[index]) shuffledContentMap[newKey] = q.options[shuffledKeys[index]];
            });
            q.options = shuffledContentMap;
            for (const [key, val] of Object.entries(q.options)) {
                if (val === originalCorrectContent) {
                    q.answer = key;
                    break;
                }
            }
        }

        if (q.type === 'nhieu_dap_an') {
            const keys = Object.keys(q.options);
            const shuffledKeys = shuffleArray(keys);
            const newOptions = {};
            const fixedKeys = ['a', 'b', 'c', 'd'].slice(0, keys.length);
            const correctContents = Array.isArray(q.answer) ? q.answer.map(k => q.options[k]) : [];
            const newAnswerKeys = [];
            fixedKeys.forEach((fixedKey, idx) => {
                const originalKey = shuffledKeys[idx];
                const content = q.options[originalKey];
                newOptions[fixedKey] = content;
                if (correctContents.includes(content)) newAnswerKeys.push(fixedKey);
            });
            q.options = newOptions;
            q.answer = newAnswerKeys;
        }

        if (q.type === 'noi') {
            const rightObjects = (q.rightCol || []).map((txt, idx) => ({ text: txt, originalIndex: idx }));
            q.shuffledRightCol = shuffleArray(rightObjects);
        }

        return q;
    }

    // -------------------------------------------------------------------------
    // 7. LEARNING ENGINE A90
    // -------------------------------------------------------------------------
    function recordLearningResult(question, isCorrect) {
        const userData = state.allUsersData[state.currentUserName];
        if (!userData || !question || !question.id) return;

        ensureUserLearningData(userData);
        const topicKey = getCurrentTopicKey(dom.subjectSelector.value, dom.topicSelector.value);

        if (!userData.wrongQuestionIdsByTopic[topicKey]) {
            userData.wrongQuestionIdsByTopic[topicKey] = [];
        }

        const wrongList = userData.wrongQuestionIdsByTopic[topicKey];
        if (!userData.mistakeFrequency[question.id]) userData.mistakeFrequency[question.id] = 0;

        if (isCorrect) {
            const idx = wrongList.indexOf(question.id);
            if (idx !== -1) wrongList.splice(idx, 1);
        } else {
            if (!wrongList.includes(question.id)) wrongList.push(question.id);
            userData.mistakeFrequency[question.id] += 1;
        }

        userData.lastWrongQuestions = state.activeQuestions
            .filter(q => q.isAnswered && !isQuestionAnsweredCorrectly(q))
            .map(q => q.id);
    }

    function buildSmartQuestionPool(questionBank, subjectValue, topicValue) {
        const userData = ensureUserLearningData(state.allUsersData[state.currentUserName] || createUserSkeleton());
        const topicKey = getCurrentTopicKey(subjectValue, topicValue);
        const wrongIds = userData.wrongQuestionIdsByTopic[topicKey] || [];
        const mistakeFrequency = userData.mistakeFrequency || {};

        const wrongQuestions = questionBank.filter(q => wrongIds.includes(q.id));
        const freshQuestions = questionBank.filter(q => !wrongIds.includes(q.id));

        wrongQuestions.sort((a, b) => (mistakeFrequency[b.id] || 0) - (mistakeFrequency[a.id] || 0));

        const targetSize = Math.min(20, questionBank.length);
        const wrongTarget = Math.min(Math.ceil(targetSize * 0.7), wrongQuestions.length);
        const freshTarget = targetSize - wrongTarget;

        const pickedWrong = wrongQuestions.slice(0, wrongTarget);
        const pickedFresh = shuffleArray(freshQuestions).slice(0, freshTarget);

        const pool = shuffleArray([...pickedWrong, ...pickedFresh]);
        if (pool.length < targetSize) {
            const existingIds = new Set(pool.map(q => q.id));
            const filler = shuffleArray(questionBank).filter(q => !existingIds.has(q.id));
            pool.push(...filler.slice(0, targetSize - pool.length));
        }

        return pool.slice(0, targetSize);
    }

    function buildRetryWrongPool(questionBank, subjectValue, topicValue) {
        const userData = ensureUserLearningData(state.allUsersData[state.currentUserName] || createUserSkeleton());
        const topicKey = getCurrentTopicKey(subjectValue, topicValue);
        const wrongIds = userData.wrongQuestionIdsByTopic[topicKey] || [];
        return questionBank.filter(q => wrongIds.includes(q.id));
    }

    function getWrongQuestionCountForCurrentSelection() {
        const userData = state.allUsersData[state.currentUserName];
        if (!userData) return 0;
        ensureUserLearningData(userData);
        const topicKey = getCurrentTopicKey(dom.subjectSelector.value, dom.topicSelector.value);
        return (userData.wrongQuestionIdsByTopic[topicKey] || []).length;
    }

    // -------------------------------------------------------------------------
    // 8. QUIZ FLOW
    // -------------------------------------------------------------------------
    function resetQuizCounters() {
        state.currentQuestionIndex = 0;
        state.correctAnswers = 0;
        state.incorrectAnswers = 0;
        state.quizSeconds = 0;
        state.hasQuizEnded = false;
    }

    function getSelectedQuestionBank(subjectValue, topicValue) {
        if (!subjectValue) return { title: '', bank: [] };

        if (subjectValue.startsWith('comprehensive_')) {
            const subjectToTest = subjectValue.replace('comprehensive_', '');
            const bank = state.allTopics
                .filter(topic => topic.subject === subjectToTest)
                .reduce((acc, topic) => acc.concat(topic.questions), [])
                .map((q, i) => ({ ...q, id: q.id || `${subjectToTest}-all-${i}` }));
            return {
                title: `TỔNG HỢP: ${subjectToTest}`,
                bank
            };
        }

        const selectedIndex = parseInt(topicValue, 10);
        if (Number.isNaN(selectedIndex) || !state.allTopics[selectedIndex]) {
            return { title: '', bank: [] };
        }

        const selectedTopic = state.allTopics[selectedIndex];
        return {
            title: `${selectedTopic.subject.toUpperCase()} - ${selectedTopic.name}`,
            bank: deepClone(selectedTopic.questions)
        };
    }

    function getRandomQuestionPool(questionBank, subjectValue, topicValue) {
        const topicNameForSeen = subjectValue.startsWith('comprehensive_')
            ? subjectValue
            : (state.allTopics[topicValue] ? state.allTopics[topicValue].name : 'unknown_topic');

        const seenIdsForTopic = state.seenQuestionIds[topicNameForSeen] || [];
        let unseenQuestions = questionBank.filter(q => q && !seenIdsForTopic.includes(q.id));

        if (unseenQuestions.length < 10) {
            state.seenQuestionIds[topicNameForSeen] = [];
            unseenQuestions = questionBank;
        }

        return shuffleArray(unseenQuestions).slice(0, 20);
    }

    function startQuiz(mode) {
        if (state.currentUserName === '') {
            showAlert('Vui lòng nhập tên của bạn trước khi bắt đầu!');
            dom.nameInput?.focus();
            return;
        }

        localStorage.setItem(STORAGE_KEYS.LAST_TOPIC_KEY, dom.topicSelector.value);
        state.currentMode = mode;
        state.isReviewMode = false;
        state.hasQuizEnded = false;
        state.learning.currentPoolType = mode;

        if (dom.dashboardHeader) dom.dashboardHeader.textContent = state.currentUserName;
        dom.appHeader.classList.remove('hidden');
        document.body.classList.add('quiz-active');

        const subjectValue = dom.subjectSelector.value;
        const topicValue = dom.topicSelector.value;
        if (!subjectValue) {
            showAlert('Vui lòng chọn một môn học!');
            return;
        }

        const { title, bank } = getSelectedQuestionBank(subjectValue, topicValue);
        if (!title || bank.length === 0) {
            showAlert('Vui lòng chọn một chủ đề / bài học!');
            return;
        }

        state.currentQuizTitle = title;
        dom.appHeader.textContent = `<<BÀI TRẮC NGHIỆM>> ${state.currentQuizTitle}`;

        let questionPool = [];
        if (mode === 'random') {
            questionPool = getRandomQuestionPool(bank, subjectValue, topicValue);
        } else if (mode === 'smart') {
            questionPool = buildSmartQuestionPool(bank, subjectValue, topicValue);
        } else if (mode === 'retryWrong') {
            questionPool = buildRetryWrongPool(bank, subjectValue, topicValue);
        } else {
           questionPool = shuffleArray(bank);
        }

        if (mode === 'retryWrong' && questionPool.length === 0) {
            showAlert('🎉 Không có câu sai nào để luyện lại!');
            return;
        }

        state.activeQuestions = questionPool.map(prepareQuestionData);
        if (state.activeQuestions.length === 0) {
            showAlert('Không có câu hỏi nào để hiển thị.');
            return;
        }

        resetQuizCounters();
        dom.startScreen.classList.add('hidden');
        dom.quizScreen.classList.remove('hidden');
        updateUserCupDisplay();
        createQuestionNav();
        startTimer();
        playSound(sounds.start, 0.5);
        displayQuestion();
        updateDashboard();

        if (submitQuizBtn) {
            submitQuizBtn.style.display = 'inline-block';
            submitQuizBtn.onclick = () => {
                if (showConfirm('Bạn có chắc muốn NỘP BÀI và kết thúc ngay không?')) {
                    endQuiz();
                }
            };
        }
    }

    function endQuiz() {
        if (state.hasQuizEnded) return;
        state.hasQuizEnded = true;
        clearInterval(state.quizTimer);

        const timeSpentFormatted = dom.dashboardTimer?.textContent || '00:00';
        const totalQuestions = state.activeQuestions.length || 1;
        const acc = Math.round((state.correctAnswers / totalQuestions) * 100) || 0;

        let userData = state.allUsersData[state.currentUserName] || createUserSkeleton();
        userData = ensureUserLearningData(userData);
        state.allUsersData[state.currentUserName] = userData;

        userData.lifetimeCorrect += state.correctAnswers;
        state.lifetimeCorrect = userData.lifetimeCorrect;

        const dataToSend = {
            name: state.currentUserName,
            topic: state.currentQuizTitle,
            score: state.correctAnswers,
            total: state.activeQuestions.length,
            acc
        };
        postScoreToGoogleScript(dataToSend);

        const quizResult = {
            topic: state.currentQuizTitle,
            score: state.correctAnswers,
            total: state.activeQuestions.length,
            accuracy: acc,
            date: new Date().toISOString(),
            timeSpent: timeSpentFormatted,
            mode: state.currentMode
        };
        userData.topicResults.push(quizResult);

        if (acc >= 90) {
            userData.cupCount++;
            showVictoryModal(state.correctAnswers, acc);
        } else {
            if (dom.finalScore) dom.finalScore.textContent = state.correctAnswers;
            if (dom.finalAccuracy) dom.finalAccuracy.textContent = `${acc}%`;
            if (dom.finalCorrect) dom.finalCorrect.textContent = state.correctAnswers;
            if (dom.finalTotal) dom.finalTotal.textContent = state.activeQuestions.length;
            dom.resultsModal.classList.remove('hidden');
        }

        if (state.currentMode === 'random') {
            const topicNameForSeen = dom.subjectSelector.value.startsWith('comprehensive_')
                ? dom.subjectSelector.value
                : (state.allTopics[dom.topicSelector.value] ? state.allTopics[dom.topicSelector.value].name : 'unknown');
            userData.seenQuestionIds[topicNameForSeen] = [
                ...new Set([...(userData.seenQuestionIds[topicNameForSeen] || []), ...state.activeQuestions.map(q => q.id)])
            ];
        }

        state.seenQuestionIds = userData.seenQuestionIds || {};
        localStorage.setItem(STORAGE_KEYS.ALL_USERS_DB_KEY, JSON.stringify(state.allUsersData));
        updateUserCupDisplay();
        updateDashboard();
        displayUserLog(state.currentUserName);
        updateLeaderboardUI();
    }

    function handleNextQuestion() {
        if (state.currentQuestionIndex < state.activeQuestions.length - 1) {
            state.currentQuestionIndex++;
            displayQuestion();
        } else if (!state.isReviewMode) {
            const confirmSubmit = showConfirm('Bạn đã hoàn thành câu hỏi cuối cùng.\n\n- Nhấn OK để NỘP BÀI.\n- Nhấn Cancel để XEM LẠI.');
            if (confirmSubmit) endQuiz();
        }
    }

    function handlePrevQuestion() {
        if (state.currentQuestionIndex > 0) {
            const currentQuestion = state.activeQuestions[state.currentQuestionIndex];
            if (currentQuestion?.type === 'noi' && !currentQuestion.isAnswered) {
                currentQuestion.userAnswer = { ...state.matchingState.userMatches };
            }
            state.currentQuestionIndex--;
            displayQuestion();
        }
    }

    function resetQuizView() {
        stopAllTTS();
        location.reload();
    }

    function startReviewMode() {
        state.isReviewMode = true;
        dom.resultsModal.classList.add('hidden');
        dom.victoryModal.classList.add('hidden');
        displayQuestion();
        updateDashboard();
    }

    // -------------------------------------------------------------------------
    // 9. DASHBOARD / LEADERBOARD / LOG
    // -------------------------------------------------------------------------
    function updateUserCupDisplay() {
        const userData = state.allUsersData[state.currentUserName];
        if (!userData) return;

        ensureUserLearningData(userData);
        state.lifetimeCorrect = userData.lifetimeCorrect || 0;

        if (dom.dashboardHeader) dom.dashboardHeader.textContent = state.currentUserName;
        if (dom.dashboardCup) dom.dashboardCup.textContent = `🏆 ${userData.cupCount || 0}`;
        if (dom.startScreenCups) dom.startScreenCups.textContent = `🏆 ${userData.cupCount || 0}`;
        if (dom.startScreenLevel) dom.startScreenLevel.textContent = calculateLevel(state.lifetimeCorrect);
        if (dom.dashboardLevel) dom.dashboardLevel.textContent = calculateLevel(state.lifetimeCorrect);
    }

    function updateDashboard() {
        if (dom.scoreValue) dom.scoreValue.textContent = state.lifetimeCorrect;
        if (dom.correctValue) dom.correctValue.textContent = state.correctAnswers;
        if (dom.incorrectValue) dom.incorrectValue.textContent = state.incorrectAnswers;

        const answered = state.correctAnswers + state.incorrectAnswers;
        const currentProgress = state.activeQuestions.length > 0 ? (answered / state.activeQuestions.length) * 100 : 0;

        if (dom.progressBar) {
            dom.progressBar.style.width = `${currentProgress}%`;
            dom.progressBar.textContent = `${Math.round(currentProgress)}%`;
        }

        if (dom.accuracyValue) {
            dom.accuracyValue.textContent = answered > 0 ? `${Math.round((state.correctAnswers / answered) * 100)}%` : '0%';
        }

        syncMobileDashboard();
    }

    function displayUserLog(name) {
        if (!dom.userLogList) return;
        const userData = state.allUsersData[name];
        if (!userData || !Array.isArray(userData.topicResults) || userData.topicResults.length === 0) {
            dom.userLogList.innerHTML = '<li>Chưa có dữ liệu</li>';
            return;
        }
        dom.userLogList.innerHTML = '';
        userData.topicResults.slice().reverse().forEach(log => {
            const d = new Date(log.date);
            dom.userLogList.innerHTML += `<li class="log-item"><b>${escapeHtml(log.topic)}</b>: ${log.score}/${log.total} (${log.accuracy}%) - ${d.toLocaleDateString()}</li>`;
        });
    }

    function updateLeaderboardUI() {
        if (!dom.leaderboardList) return;
        dom.leaderboardList.innerHTML = '';
        const sortedUsers = Object.entries(state.allUsersData).sort((a, b) => (b[1].cupCount || 0) - (a[1].cupCount || 0));
        sortedUsers.slice(0, 5).forEach((entry, index) => {
            const [userName, userData] = entry;
            const li = document.createElement('li');
            li.innerHTML = `<span>${index + 1}. <b>${escapeHtml(userName)}</b></span><span>🏆 ${userData.cupCount || 0}</span>`;
            dom.leaderboardList.appendChild(li);
        });
    }

    function showVictoryModal(score, accuracy) {
        if (dom.victoryScore) dom.victoryScore.textContent = `${score} (${accuracy}%)`;
        dom.victoryModal.classList.remove('hidden');
        playSound(sounds.victory);
    }

    // -------------------------------------------------------------------------
    // 10. TIMER / NAV GRID
    // -------------------------------------------------------------------------
    function startTimer() {
        clearInterval(state.quizTimer);
        if (state.isReviewMode) {
            if (dom.dashboardTimer) dom.dashboardTimer.textContent = 'Xem lại';
            syncMobileDashboard();
            return;
        }

        state.quizStartTime = new Date();
        state.quizSeconds = 0;
        if (dom.dashboardTimer) dom.dashboardTimer.textContent = '00:00';
        syncMobileDashboard();

        state.quizTimer = setInterval(() => {
            state.quizSeconds++;
            if (dom.dashboardTimer) {
                dom.dashboardTimer.textContent = `${String(Math.floor(state.quizSeconds / 60)).padStart(2, '0')}:${String(state.quizSeconds % 60).padStart(2, '0')}`;
            }
            syncMobileDashboard();
        }, 1000);
    }

    function createQuestionNav() {
        if (!dom.questionNavGrid) return;
        dom.questionNavGrid.innerHTML = '';
        state.activeQuestions.forEach((_, i) => {
            const navItem = document.createElement('div');
            navItem.className = 'nav-item';
            navItem.id = `nav-item-${i}`;
            navItem.textContent = i + 1;
            navItem.addEventListener('click', () => {
                clearTimeout(state.autoAdvanceTimeout);
                state.currentQuestionIndex = i;
                displayQuestion();
            });
            dom.questionNavGrid.appendChild(navItem);
        });
    }

    function updateQuestionNav(status) {
        const currentItem = $(`nav-item-${state.currentQuestionIndex}`);
        if (currentItem && status !== undefined) {
            currentItem.classList.remove('current');
            currentItem.classList.add(status ? 'correct' : 'incorrect');
        }

        document.querySelectorAll('.nav-item').forEach((item, index) => {
            item.classList.toggle('current', index === state.currentQuestionIndex && status === undefined);
        });
    }

    // -------------------------------------------------------------------------
    // 11. RENDER HELPERS
    // -------------------------------------------------------------------------
    function createOptionButton(key, content, onClick, disabled = false) {
        const button = document.createElement('button');
        button.className = 'option';
        button.dataset.answer = key;
        button.innerHTML = `<strong>${key.toUpperCase()}.</strong> ${content}`;
        button.disabled = disabled;
        if (!disabled && typeof onClick === 'function') button.addEventListener('click', onClick);
        return button;
    }

    function clearQuestionSurface() {
        clearTimeout(state.autoAdvanceTimeout);
        stopAllTTS();
        resetAIPanel();
        state.matchingState.selectedLeft = null;
        state.matchingState.userMatches = {};
        state.categorizationState.draggingTag = null;
        dom.optionsContainer.innerHTML = '';
    }

    function displayReadingPassage(question) {
        if (!dom.readingPassageContainer) return;
        if (question.doan_van && question.doan_van.trim() !== '') {
            const formattedPassage = question.doan_van
                .trim()
                .split('\n')
                .filter(line => line.trim() !== '')
                .map(line => `<p>${line.trim()}</p>`)
                .join('');
            dom.readingPassageContainer.innerHTML = `<div class="reading-passage-header">📖 ĐỌC HIỂU NGUỒN</div><div class="reading-content">${formattedPassage}</div>`;
            dom.readingPassageContainer.classList.remove('hidden');
        } else {
            dom.readingPassageContainer.classList.add('hidden');
        }
    }

    // -------------------------------------------------------------------------
    // 12. DISPLAY QUESTION
    // -------------------------------------------------------------------------
    function displayQuestion() {
        clearQuestionSurface();
        updateQuestionNav();

        const question = state.activeQuestions[state.currentQuestionIndex];
        if (!question) return;

        if (question.type === 'noi' && question.userAnswer) {
            state.matchingState.userMatches = { ...question.userAnswer };
        }

        const qType = (question.type || 'mot_dap_an').toLowerCase();
        if (dom.questionCounter) {
            dom.questionCounter.textContent = `Câu ${state.currentQuestionIndex + 1} / ${state.activeQuestions.length}`;
        }

        if (qType === 'dropdown') {
            dom.questionText.style.display = 'none';
            dom.questionText.innerHTML = '';
        } else {
            dom.questionText.style.display = 'block';
            dom.questionText.innerHTML = fixMalformedSVG(question.question || '');
        }

        displayReadingPassage(question);

        switch (qType) {
            case 'speaking':
                renderSpeaking(question);
                break;
            case 'listening':
                renderListening(question);
                break;
            case 'dien_khuyet':
                renderFillInTheBlank(question);
                break;
            case 'noi':
                renderMatching(question);
                break;
            case 'nhieu_dap_an':
                renderMultiResponse(question);
                break;
            case 'dropdown':
                renderDropdown(question);
                break;
            case 'sap_xep':
                renderOrdering(question);
                break;
            case 'phan_loai':
                renderCategorization(question);
                break;
            case 'dung_sai':
                renderTrueFalse(question);
                break;
            default:
                renderMultipleChoice(question);
                break;
        }

        if (question.isAnswered || state.isReviewMode) {
            showAnswerState(question);
        } else {
            dom.explanationBox.classList.add('hidden');
        }

        updateQuestionNav();
        syncMobileDashboard();
        if (window.MathJax) {
            MathJax.typesetPromise([dom.questionText, dom.optionsContainer, dom.explanationBox]).catch(() => {});
        }
    }

    // -------------------------------------------------------------------------
    // 13. RENDERERS
    // -------------------------------------------------------------------------
    function renderMultipleChoice(question) {
        if (!question.options) return;
        Object.keys(question.options).sort().forEach(key => {
            const btn = createOptionButton(key, question.options[key], () => selectAnswer(key), question.isAnswered || state.isReviewMode);
            dom.optionsContainer.appendChild(btn);
        });
    }

    function renderListening(question) {
        if (!question.options) return;
        dom.optionsContainer.innerHTML = `
            <div class="listening-container" style="text-align: center; margin-bottom: 25px; padding: 25px; background: #f8fafc; border-radius: 16px; border: 2px dashed #6366f1;">
                <button id="play-audio-btn" class="nav-btn" style="background: linear-gradient(45deg, #f59e0b, #d97706); width: auto; padding: 15px 40px; font-size: 1.1rem; border-radius: 50px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);">
                    🎧 IVY VOICE
                </button>
                <p style="font-size: 0.95rem; color: #6b7280; margin-top: 12px; font-weight: 700;">Click để nghe đoạn hội thoại học thuật</p>
            </div>
            <div id="listening-options-wrapper" style="width: 100%;"></div>
        `;

        const playBtn = $('play-audio-btn');
        if (playBtn) {
            playBtn.onclick = () => {
                if (!question.audio_text) {
                    showAlert('Lỗi Dữ Liệu: Không tìm thấy nội dung bài nghe.');
                    return;
                }
                playNativeAudio(question.audio_text);
            };
        }

        const optionsWrapper = $('listening-options-wrapper');
        Object.keys(question.options).sort().forEach(key => {
            const button = createOptionButton(key, question.options[key], () => selectAnswer(key), question.isAnswered || state.isReviewMode);
            optionsWrapper?.appendChild(button);
        });
    }

function renderSpeaking(question) {
    if (!question.attempts) question.attempts = 0;

    dom.optionsContainer.innerHTML = `
    <div class="speaking-ui-v2">
        <h3 class="speaking-title">🎤 IELTS Speaking</h3>
        <p class="speaking-target-text">"${escapeHtml(question.answer || '')}"</p>

        <div class="voice-controls">
            <button id="play-btn" class="icon-btn" title="Nghe">👂</button>
            <button id="slow-btn" class="icon-btn" title="Nghe chậm">👂👂</button>
        </div>

        <div class="visualizer-container">
            <canvas id="waveform" width="250" height="50"></canvas>
        </div>

        <div class="mic-section">
            <button id="speak-btn" class="mic-btn-v2">🎙️</button>
            <p id="status-text">Nhấn để bắt đầu nói</p>
        </div>

        <div id="result-area">
            <p id="result"></p>
            <p id="score"></p>
        </div>
        
        <div class="attempts-badge">Lần thử: ${question.attempts}/3</div>
    </div>
    `;

    const playBtn = document.getElementById('play-btn');
    const slowBtn = document.getElementById('slow-btn');
    const speakBtn = document.getElementById('speak-btn');

    if (playBtn) playBtn.onclick = () => playNativeAudio(question.answer);
    if (slowBtn) slowBtn.onclick = () => playSlow(question.answer);
    if (speakBtn) speakBtn.onclick = () => startIELTSSpeaking(question);
}



async function startIELTSSpeaking(question) {
    const rec = state.speech.recognition;

    if (!rec) {
        alert("Browser không hỗ trợ mic");
        return;
    }

    // 🔥 reset trước
    stopMicVisualizer();

    const ok = await initMicVisualizer();
    if (!ok) return;

    drawWaveform();

    document.body.classList.add('recording');

    rec.onstart = () => {
        console.log("🎤 Recording...");
    };

    rec.onend = () => {
        document.body.classList.remove('recording');
      stopMicVisualizer(); // reset nếu user bấm nhiều lần
    };

    rec.onerror = (e) => {
        console.error("Speech error", e);
        document.body.classList.remove('recording');
      stopMicVisualizer(); // reset nếu user bấm nhiều lần
    };

    rec.onresult = (e) => {
        const text = e.results[0][0].transcript;

        question.attempts = (question.attempts || 0) + 1;

        const result = evaluateSpeakingIELTS(text, question.answer);

        $('result').innerHTML = `Bạn nói: <b>${text}</b>`;
        $('score').innerHTML = `Band: ${result.band} | Similarity: ${result.similarity}%`;

        if (question.attempts >= 3) {
            finalizeAnswer(result.band >= 6, question);
        }
    };

    rec.start();

    setTimeout(() => {
        try { rec.stop(); } catch (_) {}
    }, 6000);
}

    function renderMultiResponse(question) {
        if (!question.options) return;
        dom.optionsContainer.innerHTML = '<p style="font-size: 0.9rem; color: var(--grey-text); margin-bottom: 10px;">(Chọn tất cả các đáp án đúng)</p>';
        const checkBtn = document.createElement('button');
        checkBtn.id = 'multi-check-btn';
        checkBtn.className = 'nav-btn';
        checkBtn.textContent = 'Kiểm tra đáp án';

        Object.keys(question.options).sort().forEach(key => {
            const button = createOptionButton(key, question.options[key], null, question.isAnswered || state.isReviewMode);
            if (question.isAnswered || state.isReviewMode) {
                if (question.userAnswer && question.userAnswer.includes(key)) button.classList.add('selected');
            } else {
                button.addEventListener('click', () => {
                    button.classList.toggle('selected');
                    checkBtn.disabled = dom.optionsContainer.querySelectorAll('.option.selected').length === 0;
                });
            }
            dom.optionsContainer.appendChild(button);
        });

        if (!question.isAnswered && !state.isReviewMode) {
            checkBtn.disabled = true;
            checkBtn.addEventListener('click', checkMultiResponseAnswer);
            dom.optionsContainer.appendChild(checkBtn);
        }
    }

    function renderMatching(question) {
        const leftCol = question.leftCol || [];
        const displayRightCol = question.shuffledRightCol || (question.rightCol || []).map((t, i) => ({ text: t, originalIndex: i }));
        let leftHtml = '';
        let rightHtml = '';

        leftCol.forEach((item, index) => {
            leftHtml += `<div class="match-item match-left" data-match-id="left-${index}">${item}</div>`;
        });
        displayRightCol.forEach(item => {
            rightHtml += `<div class="match-item match-right" data-match-id="right-${item.originalIndex}">${item.text}</div>`;
        });

        dom.optionsContainer.innerHTML = `
            <div id="matching-container">
                <svg id="matching-svg-canvas"></svg>
                <div id="matching-col-left">${leftHtml}</div>
                <div id="matching-col-right">${rightHtml}</div>
            </div>
            <button id="match-check-btn" class="nav-btn">Kiểm tra đáp án</button>`;

        const checkBtn = $('match-check-btn');
        drawMatchingLines(question.isAnswered || state.isReviewMode);

        if (!question.isAnswered && !state.isReviewMode) {
            checkBtn.disabled = Object.keys(state.matchingState.userMatches).length === 0;
            document.querySelectorAll('.match-item').forEach(item => item.addEventListener('click', handleMatchClick));
            checkBtn.addEventListener('click', checkMatchingAnswer);
        } else {
            checkBtn.style.display = 'none';
            document.querySelectorAll('.match-item').forEach(item => { item.style.pointerEvents = 'none'; });
        }

        window.removeEventListener('resize', handleResizeMatching);
        window.addEventListener('resize', handleResizeMatching);
    }

    function renderDropdown(question) {
        question.correctDropdowns = [];
        const processedHTML = (question.question || '').replace(/\[\[(.*?)\]\]/g, (_, content) => {
            const options = content.split('|');
            question.correctDropdowns.push(options[0]);
            const shuffledOptions = shuffleArray(options);
            let selectHTML = '<select class="dropdown-select"><option value="">...</option>';
            shuffledOptions.forEach(opt => {
                const safeOpt = opt.replace(/"/g, '&quot;');
                selectHTML += `<option value="${safeOpt}">${opt}</option>`;
            });
            return `${selectHTML}</select>`;
        });

        dom.optionsContainer.innerHTML = `<div class="dropdown-question-text">${processedHTML}</div>`;

        if (!question.isAnswered && !state.isReviewMode) {
            const checkBtn = document.createElement('button');
            checkBtn.id = 'dropdown-check-btn';
            checkBtn.className = 'nav-btn';
            checkBtn.textContent = 'Kiểm tra đáp án';
            checkBtn.disabled = true;
            dom.optionsContainer.appendChild(checkBtn);

            const allSelects = dom.optionsContainer.querySelectorAll('.dropdown-select');
            allSelects.forEach(select => {
                select.addEventListener('change', () => {
                    checkBtn.disabled = Array.from(allSelects).every(s => s.value === '');
                });
            });
            checkBtn.addEventListener('click', checkDropdownAnswer);
        } else if (question.userAnswer) {
            dom.optionsContainer.querySelectorAll('.dropdown-select').forEach((select, index) => {
                select.value = question.userAnswer[index] || '';
                select.disabled = true;
            });
        }
    }

    function renderFillInTheBlank(question) {
        const previousAnswer = question.userAnswer !== null ? question.userAnswer : '';
        const safePrevAnswer = previousAnswer.toString().replace(/"/g, '&quot;');
        dom.optionsContainer.innerHTML = `<div style="display: flex; gap: 10px;"><input type="text" id="fill-in-input" class="option" placeholder="Nhập câu trả lời..." value="${safePrevAnswer}" autocomplete="off"><button id="fill-in-submit" class="nav-btn">Kiểm tra</button></div>`;

        const inputEl = $('fill-in-input');
        const submitBtn = $('fill-in-submit');
        if (!inputEl || !submitBtn) return;

        if (!question.isAnswered && !state.isReviewMode) {
            submitBtn.disabled = true;
            inputEl.addEventListener('input', () => {
                submitBtn.disabled = inputEl.value.trim() === '';
            });
            submitBtn.addEventListener('click', () => selectAnswer(inputEl.value));
            inputEl.addEventListener('keypress', e => {
                if (e.key === 'Enter' && !submitBtn.disabled) selectAnswer(inputEl.value);
            });
            setTimeout(() => inputEl.focus(), 100);
        } else {
            inputEl.disabled = true;
            submitBtn.style.display = 'none';
        }
    }

    function renderCategorization(question) {
        let groupsHTML = '';
        (question.nhom || []).forEach((nhomText, index) => {
            groupsHTML += `<div class="category-group-box" data-group-index="${index}"><h4>${nhomText}</h4></div>`;
        });

        let tagsHTML = '';
        shuffleArray(question.the || []).forEach(tagText => {
            const safeTagText = tagText.replace(/"/g, '&quot;');
            tagsHTML += `<div class="category-tag" draggable="true" data-tag-text="${safeTagText}">${tagText}</div>`;
        });

        dom.optionsContainer.innerHTML = `<div class="categorization-container"><div class="category-groups">${groupsHTML}</div><p style="text-align: center; color: var(--grey-text);">🔻 Kéo các thẻ vào nhóm tương ứng 🔻</p><div class="category-tags-pool">${tagsHTML}</div></div><button id="category-check-btn" class="nav-btn">Kiểm tra đáp án</button>`;

        const checkBtn = $('category-check-btn');
        if (!checkBtn) return;

        if (!question.isAnswered && !state.isReviewMode) {
            checkBtn.disabled = true;
            setupDragAndDrop(checkBtn);
            checkBtn.addEventListener('click', checkCategorizationAnswer);
        }

        if (state.isReviewMode && question.userAnswer) {
            checkBtn.style.display = 'none';
            const tagsPool = dom.optionsContainer.querySelector('.category-tags-pool');
            tagsPool.innerHTML = '';
            Object.entries(question.userAnswer).forEach(([tagText, groupIndex]) => {
                const tag = document.createElement('div');
                tag.className = 'category-tag';
                tag.dataset.tagText = tagText.replace(/"/g, '&quot;');
                tag.textContent = tagText;
                if (groupIndex === -1) tagsPool.appendChild(tag);
                else {
                    const groupZone = dom.optionsContainer.querySelector(`.category-group-box[data-group-index="${groupIndex}"]`);
                    if (groupZone) groupZone.appendChild(tag);
                }
            });
        }
    }

    function renderTrueFalse(question) {
        dom.optionsContainer.innerHTML = '<div class="tf-button-container"><button class="option tf-btn" data-answer="dung">ĐÚNG</button><button class="option tf-btn" data-answer="sai">SAI</button></div>';
        if (!question.isAnswered && !state.isReviewMode) {
            dom.optionsContainer.querySelectorAll('.tf-btn').forEach(btn => {
                btn.addEventListener('click', () => selectAnswer(btn.dataset.answer));
            });
        }
    }

    function renderOrdering(question) {
        const itemsToShow = (question.isAnswered || state.isReviewMode) ? (question.userAnswer || []) : shuffleArray(question.muc || []);
        let itemsHTML = '';
        itemsToShow.forEach(itemText => {
            const safeItemText = itemText.replace(/"/g, '&quot;');
            itemsHTML += `<li class="ordering-item" draggable="true" data-text="${safeItemText}">${itemText}</li>`;
        });

        dom.optionsContainer.innerHTML = `<div style="font-style: italic; color: var(--grey-text); margin-bottom: 10px; text-align: center;">(Kéo thả để sắp xếp)</div><ul id="ordering-list" class="ordering-container">${itemsHTML}</ul><button id="order-check-btn" class="nav-btn">Kiểm tra đáp án</button>`;

        const checkBtn = $('order-check-btn');
        if (!checkBtn) return;
        if (!question.isAnswered && !state.isReviewMode) {
            checkBtn.disabled = true;
            setupOrderingDrag(checkBtn);
            checkBtn.addEventListener('click', checkOrderingAnswer);
        } else {
            checkBtn.style.display = 'none';
        }
    }

    // -------------------------------------------------------------------------
    // 14. MATCHING / DRAG HELPERS
    // -------------------------------------------------------------------------
    function handleMatchClick(e) {
        const clickedItem = e.target;
        const id = clickedItem.dataset.matchId;

        if (clickedItem.classList.contains('matched')) {
            let leftKeyToRemove = null;
            if (id.startsWith('left-')) leftKeyToRemove = id;
            else {
                for (const [key, value] of Object.entries(state.matchingState.userMatches)) {
                    if (value === id) {
                        leftKeyToRemove = key;
                        break;
                    }
                }
            }
            if (leftKeyToRemove) {
                delete state.matchingState.userMatches[leftKeyToRemove];
                updateMatchingClasses();
                drawMatchingLines(false);
                const checkBtn = $('match-check-btn');
                if (checkBtn) checkBtn.disabled = Object.keys(state.matchingState.userMatches).length === 0;
            }
            return;
        }

        if (id.startsWith('left-')) {
            if (state.matchingState.selectedLeft === clickedItem) {
                state.matchingState.selectedLeft.classList.remove('selected');
                state.matchingState.selectedLeft = null;
            } else {
                if (state.matchingState.selectedLeft) state.matchingState.selectedLeft.classList.remove('selected');
                state.matchingState.selectedLeft = clickedItem;
                clickedItem.classList.add('selected');
            }
        } else if (id.startsWith('right-') && state.matchingState.selectedLeft) {
            const isRightTaken = Object.values(state.matchingState.userMatches).includes(id);
            if (isRightTaken) return;
            const leftId = state.matchingState.selectedLeft.dataset.matchId;
            state.matchingState.userMatches[leftId] = id;
            updateMatchingClasses();
            state.matchingState.selectedLeft.classList.remove('selected');
            state.matchingState.selectedLeft = null;
            drawMatchingLines(false);
            const checkBtn = $('match-check-btn');
            if (checkBtn) checkBtn.disabled = false;
        }
    }

    function updateMatchingClasses() {
        document.querySelectorAll('.match-item').forEach(el => el.classList.remove('matched'));
        for (const leftId in state.matchingState.userMatches) {
            const rightId = state.matchingState.userMatches[leftId];
            const l = document.querySelector(`[data-match-id="${leftId}"]`);
            const r = document.querySelector(`[data-match-id="${rightId}"]`);
            if (l) l.classList.add('matched');
            if (r) r.classList.add('matched');
        }
    }

    function drawMatchingLines(isReview) {
        const svg = $('matching-svg-canvas');
        if (!svg) return;
        svg.innerHTML = '';

        const container = $('matching-container');
        if (!container) return;
        const containerRect = container.getBoundingClientRect();

        for (const leftId in state.matchingState.userMatches) {
            const rightId = state.matchingState.userMatches[leftId];
            drawLine(svg, leftId, rightId, containerRect, isReview);
        }

        if (isReview && state.activeQuestions[state.currentQuestionIndex]) {
            state.activeQuestions[state.currentQuestionIndex].leftCol.forEach((_, idx) => {
                const correctLeftId = `left-${idx}`;
                const correctRightId = `right-${idx}`;
                if (state.matchingState.userMatches[correctLeftId] !== correctRightId) {
                    drawLine(svg, correctLeftId, correctRightId, containerRect, false, true);
                }
            });
        }
    }

    function drawLine(svg, leftId, rightId, containerRect, isReview, isHint = false) {
        const leftEl = document.querySelector(`[data-match-id="${leftId}"]`);
        const rightEl = document.querySelector(`[data-match-id="${rightId}"]`);
        if (!leftEl || !rightEl) return;

        const leftRect = leftEl.getBoundingClientRect();
        const rightRect = rightEl.getBoundingClientRect();
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', leftRect.right - containerRect.left);
        line.setAttribute('y1', leftRect.top - containerRect.top + leftRect.height / 2);
        line.setAttribute('x2', rightRect.left - containerRect.left);
        line.setAttribute('y2', rightRect.top - containerRect.top + rightRect.height / 2);

        if (isHint) line.classList.add('hint-line');
        else if (isReview) {
            const leftIndex = leftId.split('-')[1];
            const rightIndex = rightId.split('-')[1];
            line.classList.add(leftIndex === rightIndex ? 'correct-line' : 'incorrect-line');
        } else line.classList.add('pending');

        svg.appendChild(line);
    }

    function handleResizeMatching() {
        const q = state.activeQuestions[state.currentQuestionIndex];
        if (q && q.type === 'noi') {
            drawMatchingLines(state.isReviewMode || q.isAnswered);
        }
    }

    function setupDragAndDrop(checkBtn) {
        const tags = document.querySelectorAll('.category-tag');
        const poolZone = document.querySelector('.category-tags-pool');

        tags.forEach(tag => {
            tag.addEventListener('dragstart', () => {
                state.categorizationState.draggingTag = tag;
                tag.classList.add('dragging');
            });
            tag.addEventListener('dragend', () => {
                tag.classList.remove('dragging');
                state.categorizationState.draggingTag = null;
                if (poolZone.children.length < tags.length) checkBtn.disabled = false;
            });
            tag.addEventListener('touchstart', () => {
                state.categorizationState.draggingTag = tag;
                tag.classList.add('dragging');
            }, { passive: false });
            tag.addEventListener('touchend', e => {
                tag.classList.remove('dragging');
                const touch = e.changedTouches[0];
                const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                if (elementBelow) {
                    const dropZone = elementBelow.closest('.category-group-box, .category-tags-pool');
                    if (dropZone) {
                        dropZone.appendChild(tag);
                        if (poolZone.children.length < tags.length) checkBtn.disabled = false;
                    }
                }
            });
            tag.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
        });

        document.querySelectorAll('.category-group-box, .category-tags-pool').forEach(zone => {
            zone.addEventListener('dragover', e => {
                e.preventDefault();
                zone.classList.add('drag-over');
            });
            zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
            zone.addEventListener('drop', e => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                if (state.categorizationState.draggingTag) zone.appendChild(state.categorizationState.draggingTag);
            });
        });
    }

    function setupOrderingDrag(checkBtn) {
        const list = $('ordering-list');
        if (!list) return;
        let draggingItem = null;

        list.querySelectorAll('.ordering-item').forEach(item => {
            item.addEventListener('dragstart', () => {
                draggingItem = item;
                setTimeout(() => item.classList.add('dragging'), 0);
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggingItem = null;
                checkBtn.disabled = false;
            });
            item.addEventListener('dragover', e => {
                e.preventDefault();
                const afterElement = getDragAfterElement(list, e.clientY);
                if (afterElement == null) list.appendChild(draggingItem);
                else list.insertBefore(draggingItem, afterElement);
            });
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.ordering-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset, element: child };
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // -------------------------------------------------------------------------
    // 15. CHECKING / ANSWERING
    // -------------------------------------------------------------------------
    function selectAnswer(userSelection) {
        const question = state.activeQuestions[state.currentQuestionIndex];
        if (!question || question.isAnswered) return;

        question.isAnswered = true;
        question.userAnswer = userSelection;
        const isCorrect = question.type === 'dien_khuyet'
            ? normalizeString(userSelection) === normalizeString(question.answer)
            : userSelection === question.answer;
        question._isCorrect = isCorrect;
        finalizeAnswer(isCorrect, question);
    }

    function checkMultiResponseAnswer() {
        const question = state.activeQuestions[state.currentQuestionIndex];
        const selected = Array.from(dom.optionsContainer.querySelectorAll('.option.selected')).map(b => b.dataset.answer);
        question.isAnswered = true;
        const isCorrect = JSON.stringify(selected.slice().sort()) === JSON.stringify((question.answer || []).slice().sort());
        question.userAnswer = selected;
        question._isCorrect = isCorrect;
        finalizeAnswer(isCorrect, question);
    }

    function checkMatchingAnswer() {
        const question = state.activeQuestions[state.currentQuestionIndex];
        const userMatches = state.matchingState.userMatches;
        let correctCount = 0;
        for (const [leftId, rightId] of Object.entries(userMatches)) {
            const leftIndex = leftId.split('-')[1];
            const rightIndex = rightId.split('-')[1];
            if (leftIndex === rightIndex) correctCount++;
        }
        const isCorrect = (correctCount === question.leftCol.length) && (Object.keys(userMatches).length === question.leftCol.length);
        question.isAnswered = true;
        question.userAnswer = { ...userMatches };
        question._isCorrect = isCorrect;
        finalizeAnswer(isCorrect, question);
    }

    function checkDropdownAnswer() {
        const question = state.activeQuestions[state.currentQuestionIndex];
        const selects = dom.optionsContainer.querySelectorAll('.dropdown-select');
        const userAnswers = Array.from(selects).map(s => s.value);
        let isCorrect = true;
        userAnswers.forEach((ans, idx) => {
            if (ans !== question.correctDropdowns[idx]) isCorrect = false;
        });
        question.isAnswered = true;
        question.userAnswer = userAnswers;
        question._isCorrect = isCorrect;
        selects.forEach((s, idx) => {
            s.disabled = true;
            if (s.value === question.correctDropdowns[idx]) s.classList.add('correct');
            else s.classList.add('incorrect');
        });
        finalizeAnswer(isCorrect, question);
    }

    function checkCategorizationAnswer() {
        const question = state.activeQuestions[state.currentQuestionIndex];
        const groupBoxes = dom.optionsContainer.querySelectorAll('.category-group-box');
        const userMap = {};
        let isCorrect = true;

        groupBoxes.forEach(box => {
            const groupIndex = parseInt(box.dataset.groupIndex, 10);
            const tags = box.querySelectorAll('.category-tag');
            tags.forEach(tag => {
                userMap[tag.dataset.tagText] = groupIndex;
                const correctGroupIndex = question.dap_an[tag.dataset.tagText];
                if (groupIndex === correctGroupIndex) tag.classList.add('correct');
                else {
                    tag.classList.add('incorrect');
                    isCorrect = false;
                }
            });
        });

        if (dom.optionsContainer.querySelectorAll('.category-tags-pool .category-tag').length > 0) isCorrect = false;
        question.isAnswered = true;
        question.userAnswer = userMap;
        question._isCorrect = isCorrect;
        finalizeAnswer(isCorrect, question);
    }

    function checkOrderingAnswer() {
        const question = state.activeQuestions[state.currentQuestionIndex];
        const items = dom.optionsContainer.querySelectorAll('.ordering-item');
        const userOrder = Array.from(items).map(i => i.dataset.text);
        const isCorrect = JSON.stringify(userOrder) === JSON.stringify(question.muc);
        items.forEach((item, index) => {
            item.draggable = false;
            if (item.dataset.text === question.muc[index]) item.classList.add('correct');
            else item.classList.add('incorrect');
        });
        question.isAnswered = true;
        question.userAnswer = userOrder;
        question._isCorrect = isCorrect;
        finalizeAnswer(isCorrect, question);
    }

    function finalizeAnswer(isCorrect, question) {
        recordLearningResult(question, isCorrect);

        if (isCorrect) {
            state.correctAnswers++;
            playSound(sounds.correct);
        } else {
            state.incorrectAnswers++;
            playSound(sounds.incorrect);
        }

        updateQuestionNav(isCorrect);

        setTimeout(() => {
            showAnswerState(question);
            updateDashboard();
            if (state.currentQuestionIndex < state.activeQuestions.length - 1 && !NON_AUTO_ADVANCE_TYPES.includes(question.type)) {
                state.autoAdvanceTimeout = setTimeout(handleNextQuestion, AUTO_ADVANCE_DELAY);
            }
        }, 100);
    }

    function showAnswerState(question) {
        showExplanation(question);
        const options = dom.optionsContainer.querySelectorAll('.option:not(input)');

        options.forEach(btn => {
            const key = btn.dataset.answer;
            if (!key) return;

            const isMulti = Array.isArray(question.answer);
            const isCorrectAnswer = isMulti ? question.answer.includes(key) : question.answer === key;
            const isUserSelected = isMulti
                ? (question.userAnswer && question.userAnswer.includes(key))
                : question.userAnswer === key;

            if (isCorrectAnswer) btn.classList.add('correct', 'highlighted');
            if (isUserSelected && !isCorrectAnswer) btn.classList.add('incorrect', 'highlighted');
        });

        if (question.type === 'dien_khuyet') {
            const inputEl = $('fill-in-input');
            if (inputEl) inputEl.classList.add(question._isCorrect ? 'correct' : 'incorrect', 'highlighted');
        }

        if (question.type === 'noi') {
            drawMatchingLines(true);
            for (const leftId in state.matchingState.userMatches) {
                const rightId = state.matchingState.userMatches[leftId];
                const isMatchCorrect = leftId.split('-')[1] === rightId.split('-')[1];
                const leftEl = document.querySelector(`[data-match-id="${leftId}"]`);
                const rightEl = document.querySelector(`[data-match-id="${rightId}"]`);
                if (isMatchCorrect) {
                    if (leftEl) { leftEl.classList.remove('matched'); leftEl.classList.add('correct'); }
                    if (rightEl) { rightEl.classList.remove('matched'); rightEl.classList.add('correct'); }
                } else {
                    if (leftEl) { leftEl.classList.remove('matched'); leftEl.classList.add('incorrect'); }
                    if (rightEl) { rightEl.classList.remove('matched'); rightEl.classList.add('incorrect'); }
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // 16. SUBJECT / TOPIC UI
    // -------------------------------------------------------------------------
    function updateLearningHint() {
        const wrongCount = getWrongQuestionCountForCurrentSelection();
        if (dom.topicTotalQuestions) {
            const count = dom.topicTotalQuestions.textContent || '0';
            dom.topicTotalQuestions.textContent = wrongCount > 0 ? `${count} | Câu sai cần ôn: ${wrongCount}` : count;
        }
    }

    function populateSubjectSelector() {
        dom.subjectSelector.innerHTML = '<option value="">--- Vui lòng chọn ---</option>';
        if (state.allTopics.length === 0) return;

        const subjects = {};
        state.allTopics.forEach(topic => {
            if (!subjects[topic.subject]) subjects[topic.subject] = [];
            subjects[topic.subject].push(topic);
        });

        Object.keys(subjects).sort().forEach(subject => {
            const opt = document.createElement('option');
            opt.value = subject;
            opt.textContent = subject;
            dom.subjectSelector.appendChild(opt);
        });

        const compGroup = document.createElement('optgroup');
        compGroup.label = 'TỔNG HỢP';
        Object.keys(subjects).sort().forEach(subject => {
            const opt = document.createElement('option');
            opt.value = `comprehensive_${subject}`;
            opt.textContent = `Tổng hợp ${subject}`;
            compGroup.appendChild(opt);
        });
        dom.subjectSelector.appendChild(compGroup);
        handleSubjectChange();
    }

    function handleSubjectChange() {
        const val = dom.subjectSelector.value;
        if (!val || val.startsWith('comprehensive_')) {
            dom.topicSelector.innerHTML = '<option>---</option>';
            dom.topicSelector.disabled = true;
        } else {
            dom.topicSelector.disabled = false;
            dom.topicSelector.innerHTML = '<option value="">--- Chọn Bài ---</option>';
            state.allTopics.filter(t => t.subject === val).forEach(topic => {
                const opt = document.createElement('option');
                opt.value = topic.originalIndex;
                opt.textContent = topic.name;
                dom.topicSelector.appendChild(opt);
            });
        }
        updateTopicQuestionCount();
        randomizeSlogan();
    }

    function updateTopicQuestionCount() {
        const sVal = dom.subjectSelector.value;
        const tVal = dom.topicSelector.value;
        let count = 0;

        if (sVal.startsWith('comprehensive_')) {
            const subj = sVal.replace('comprehensive_', '');
            count = state.allTopics.filter(t => t.subject === subj).reduce((a, b) => a + b.questions.length, 0);
        } else if (tVal && state.allTopics[tVal]) {
            count = state.allTopics[tVal].questions.length;
        }

        if (dom.topicTotalQuestions) dom.topicTotalQuestions.textContent = count;
        updateLearningHint();
    }

    // -------------------------------------------------------------------------
    // 17. REPORT / EXPORT / IMPORT / NETWORK
    // -------------------------------------------------------------------------
    function handlePrintSummaryReport() {
        if (!state.currentUserName) return;
        const userData = state.allUsersData[state.currentUserName];
        if (!userData || !userData.topicResults || userData.topicResults.length === 0) {
            showAlert('Chưa có kết quả để in.');
            return;
        }

        let filteredResults = userData.topicResults;
        if (!dom.reportStartDate.value && !dom.reportEndDate.value) {
            const today = new Date().toDateString();
            filteredResults = userData.topicResults.filter(log => new Date(log.date).toDateString() === today);
        } else {
            const start = dom.reportStartDate.value ? new Date(dom.reportStartDate.value) : new Date('2000-01-01');
            const end = dom.reportEndDate.value ? new Date(dom.reportEndDate.value) : new Date();
            end.setHours(23, 59, 59, 999);
            filteredResults = userData.topicResults.filter(log => {
                const d = new Date(log.date);
                return d >= start && d <= end;
            });
        }

        if (filteredResults.length === 0) {
            showAlert('Không tìm thấy kết quả trong khoảng thời gian này.');
            return;
        }

        const totalTests = filteredResults.length;
        const avgAccuracy = Math.round(filteredResults.reduce((sum, log) => sum + log.accuracy, 0) / totalTests);
        const totalCups = userData.cupCount || 0;
        const todayStr = new Date().toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        let content = `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Bảng Vàng Thành Tích - ${escapeHtml(state.currentUserName)}</title><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet"><style>body{font-family:'Nunito',sans-serif;color:#1f2937;line-height:1.6;padding:30px;background:#f3f4f6;-webkit-print-color-adjust:exact;print-color-adjust:exact}.report-container{max-width:800px;margin:0 auto;background:#fff;padding:40px;border-radius:20px;box-shadow:0 10px 25px rgba(0,0,0,.1);border-top:10px solid #6366f1}.header{text-align:center;border-bottom:2px dashed #e5e7eb;padding-bottom:25px;margin-bottom:30px}.header h1{color:#4338ca;margin:0;font-size:32px;text-transform:uppercase;font-weight:900;letter-spacing:1px}.header h2{font-size:26px;color:#f59e0b;margin:10px 0;font-weight:800}.header p{color:#6b7280;font-size:14px;margin:5px 0 0 0}.stats-grid{display:flex;justify-content:space-between;margin-bottom:35px;gap:15px}.stat-box{flex:1;background:#eef2ff;padding:20px;border-radius:16px;text-align:center;border:1px solid #c7d2fe}.stat-box h3{margin:0;font-size:36px;color:#6366f1;font-weight:900;line-height:1}.stat-box p{margin:8px 0 0 0;font-size:13px;color:#4f46e5;font-weight:800;text-transform:uppercase}.score-text{font-weight:800;color:#1f2937}table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}th,td{padding:15px;text-align:left;border-bottom:1px solid #e5e7eb}th{background:#f8fafc;font-weight:800;color:#475569;text-transform:uppercase;font-size:13px}.acc-badge{padding:6px 12px;border-radius:20px;font-weight:800;font-size:13px;display:inline-block;min-width:60px}.acc-high{background:#d1fae5;color:#065f46;border:1px solid #34d399}.acc-med{background:#fef3c7;color:#92400e;border:1px solid #fbbf24}.acc-low{background:#fee2e2;color:#991b1b;border:1px solid #f87171}.footer{text-align:center;margin-top:40px;font-size:13px;color:#9ca3af;font-style:italic;border-top:1px dashed #e5e7eb;padding-top:20px;font-weight:600}</style></head><body><div class="report-container"><div class="header"><h1>Bảng Vàng Thành Tích</h1><h2>🎓 Học giả: ${escapeHtml(state.currentUserName)}</h2><p>Thời gian xuất báo cáo: ${todayStr}</p></div><div class="stats-grid"><div class="stat-box"><h3>${totalTests}</h3><p>Bài Đã Hoàn Thành</p></div><div class="stat-box"><h3 style="color:${avgAccuracy >= 80 ? '#10b981' : avgAccuracy >= 50 ? '#f59e0b' : '#ef4444'}">${avgAccuracy}%</h3><p>Độ Chính Xác TB</p></div><div class="stat-box" style="background:#fffbeb;border-color:#fde68a"><h3 style="color:#d97706">🏆 ${totalCups}</h3><p style="color:#b45309">Cúp Danh Giá</p></div></div><table><thead><tr><th>Thời gian thi</th><th>Nội dung bài kiểm tra</th><th style="text-align:center">Điểm số</th><th style="text-align:center">Tỷ lệ</th></tr></thead><tbody>`;

        filteredResults.slice().reverse().forEach(log => {
            const d = new Date(log.date);
            const timeStr = d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            let badgeClass = 'acc-low';
            if (log.accuracy >= 80) badgeClass = 'acc-high';
            else if (log.accuracy >= 50) badgeClass = 'acc-med';
            content += `<tr><td style="font-size:.9rem;color:#64748b">${timeStr}</td><td style="font-weight:700;color:#334155">${escapeHtml(log.topic)}</td><td style="text-align:center" class="score-text">${log.score}/${log.total}</td><td style="text-align:center"><span class="acc-badge ${badgeClass}">${log.accuracy}%</span></td></tr>`;
        });

        content += `</tbody></table><div class="footer">🚀 Báo cáo được trích xuất tự động từ Hệ thống Đánh giá Năng lực Chuẩn Ivy League (A90).</div></div></body></html>`;
        const printWin = window.open('', '_blank');
        if (!printWin) return;
        printWin.document.write(content);
        printWin.document.close();
        setTimeout(() => printWin.print(), 800);
    }

    function exportBackup() {
        const dataStr = JSON.stringify(state.allUsersData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'quizapp-backup.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    async function importBackup(file) {
        if (!file) return;
        try {
            const text = await file.text();
            const imported = JSON.parse(text);
            if (!imported || typeof imported !== 'object') throw new Error('Invalid backup');
            state.allUsersData = imported;
            localStorage.setItem(STORAGE_KEYS.ALL_USERS_DB_KEY, JSON.stringify(state.allUsersData));
            showAlert('✅ Khôi phục dữ liệu thành công');
            await initializeApp();
        } catch (err) {
            console.error(err);
            showAlert('❌ Backup không hợp lệ');
        }
    }

    async function postScoreToGoogleScript(data) {
        try {
            await Promise.race([
                fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]);
        } catch (err) {
            console.error('Google log error', err);
        }
    }

    // -------------------------------------------------------------------------
    // 18. AI GURU
    // -------------------------------------------------------------------------
    async function callAIGuru(questionObj) {
        if (!dom.aiResponseArea || !dom.aiContentText) return;
        dom.aiResponseArea.classList.remove('hidden');
        dom.aiContentText.innerHTML = '🤖 <i>Gia sư Ivy League đang suy nghĩ...</i>';

        try {
            const response = await fetch(AI_GURU_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: questionObj.question,
                    userAnswer: questionObj.userAnswer,
                    correctAnswer: questionObj.answer,
                    type: questionObj.type,
                    role: 'Ivy League STEM Tutor'
                })
            });

            if (!response.ok) throw new Error(`AI server error: ${response.status}`);
            const data = await response.json();
            const reply = typeof data.reply === 'string' ? data.reply : 'AI chưa trả lời hợp lệ.';
            const formattedReply = reply.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
            dom.aiContentText.innerHTML = formattedReply;
            if (window.MathJax) MathJax.typesetPromise([dom.aiContentText]).catch(() => {});
        } catch (error) {
            console.error(error);
            dom.aiContentText.textContent = '❌ Lỗi kết nối AI. Kiểm tra lại đường truyền nhé Bruno!';
        }
    }

    // -------------------------------------------------------------------------
    // 19. INIT
    // -------------------------------------------------------------------------
    async function initializeApp() {
        try {
            state.allUsersData = safeJsonParse(localStorage.getItem(STORAGE_KEYS.ALL_USERS_DB_KEY), {}) || {};
            const lastUser = localStorage.getItem(STORAGE_KEYS.LAST_USER_KEY);

            await loadAndParseAllTopics();
            updateLeaderboardUI();

            if (lastUser && state.allUsersData[lastUser]) {
                state.currentUserName = lastUser;
                ensureUserLearningData(state.allUsersData[lastUser]);
                state.seenQuestionIds = state.allUsersData[lastUser].seenQuestionIds || {};
                dom.welcomeUser?.classList.remove('hidden');
                dom.welcomePrompt?.classList.add('hidden');
                if (dom.userSignature) dom.userSignature.textContent = state.currentUserName;
                $('user-log-container')?.classList.remove('hidden');
                updateUserCupDisplay();
                displayUserLog(state.currentUserName);
            } else {
                state.currentUserName = '';
                state.seenQuestionIds = {};
                dom.welcomeUser?.classList.add('hidden');
                dom.welcomePrompt?.classList.remove('hidden');
            }

            populateSubjectSelector();
            syncMobileDashboard();
        } catch (err) {
            console.error('Init error', err);
            showAlert('Lỗi khởi tạo hệ thống');
        }
    }

    function bindCoreEvents() {
        $('start-random-btn')?.addEventListener('click', () => startQuiz('random'));
        $('start-full-btn')?.addEventListener('click', () => startQuiz('full'));
        $('start-smart-btn')?.addEventListener('click', () => startQuiz('smart'));
        $('retry-wrong-btn')?.addEventListener('click', () => startQuiz('retryWrong'));

        dom.subjectSelector?.addEventListener('change', handleSubjectChange);
        dom.topicSelector?.addEventListener('change', updateTopicQuestionCount);
        dom.nextQuestionBtn?.addEventListener('click', handleNextQuestion);
        dom.prevQuestionBtn?.addEventListener('click', handlePrevQuestion);
        dom.stopQuizBtn?.addEventListener('click', resetQuizView);
        $('go-home-btn')?.addEventListener('click', resetQuizView);
        $('review-btn')?.addEventListener('click', startReviewMode);
        $('review-victory-btn')?.addEventListener('click', startReviewMode);
        $('go-home-victory-btn')?.addEventListener('click', resetQuizView);
        $('print-summary-report-btn')?.addEventListener('click', handlePrintSummaryReport);
        $('print-detail-report-btn')?.addEventListener('click', handlePrintSummaryReport);
        $('print-detail-victory-btn')?.addEventListener('click', handlePrintSummaryReport);

        $('new-random-btn')?.addEventListener('click', () => {
            dom.resultsModal.classList.add('hidden');
            dom.victoryModal.classList.add('hidden');
            startQuiz('random');
        });
        $('new-random-victory-btn')?.addEventListener('click', () => {
            dom.resultsModal.classList.add('hidden');
            dom.victoryModal.classList.add('hidden');
            startQuiz('random');
        });
        $('retry-wrong-after-quiz-btn')?.addEventListener('click', () => {
            dom.resultsModal.classList.add('hidden');
            dom.victoryModal.classList.add('hidden');
            startQuiz('retryWrong');
        });
        $('retry-wrong-victory-btn')?.addEventListener('click', () => {
            dom.resultsModal.classList.add('hidden');
            dom.victoryModal.classList.add('hidden');
            startQuiz('retryWrong');
        });

        dom.mobileSubmitBtn?.addEventListener('click', () => {
            if (showConfirm('Bạn có chắc muốn NỘP BÀI và kết thúc ngay không?')) endQuiz();
        });

        dom.nameInput?.addEventListener('keydown', async e => {
            if (e.key !== 'Enter') return;
            const name = e.target.value.trim();
            if (!name) {
                showAlert('Vui lòng nhập tên hợp lệ!');
                return;
            }
            localStorage.setItem(STORAGE_KEYS.LAST_USER_KEY, name);
            if (!state.allUsersData[name]) {
                state.allUsersData[name] = createUserSkeleton();
                localStorage.setItem(STORAGE_KEYS.ALL_USERS_DB_KEY, JSON.stringify(state.allUsersData));
            }
            await initializeApp();
        });

        $('change-name-btn')?.addEventListener('click', async () => {
            localStorage.removeItem(STORAGE_KEYS.LAST_USER_KEY);
            await initializeApp();
        });

        $('reset-db-btn')?.addEventListener('click', () => {
            if (showConfirm('Xóa toàn bộ dữ liệu?')) {
                localStorage.clear();
                location.reload();
            }
        });

        document.querySelectorAll('.collapsed h3').forEach(h => {
            h.addEventListener('click', function () {
                this.parentElement.classList.toggle('collapsed');
            });
        });

        dom.askAiBtn?.addEventListener('click', () => {
            if (!state.activeQuestions.length) return;
            const currentQ = state.activeQuestions[state.currentQuestionIndex];
            if (!currentQ.isAnswered) {
                showAlert('🚫 Kỷ luật là sức mạnh! Hãy hoàn thành câu hỏi này trước khi hỏi Gia sư AI.');
                return;
            }
            callAIGuru(currentQ);
        });

        $('export-btn')?.addEventListener('click', exportBackup);
        const importBtn = $('import-btn');
        const importFile = $('import-file');
        if (importBtn && importFile) {
            importBtn.addEventListener('click', () => importFile.click());
            importFile.addEventListener('change', async e => {
                const file = e.target.files?.[0];
                await importBackup(file);
                importFile.value = '';
            });
        }

        $('reset-leaderboard-link')?.addEventListener('click', e => {
            e.preventDefault();
            if (!showConfirm('Reset bảng xếp hạng?')) return;
            Object.keys(state.allUsersData).forEach(name => {
                state.allUsersData[name].cupCount = 0;
            });
            localStorage.setItem(STORAGE_KEYS.ALL_USERS_DB_KEY, JSON.stringify(state.allUsersData));
            updateLeaderboardUI();
            updateUserCupDisplay();
        });



// --- NÂNG CẤP: XỬ LÝ PHIM ENTER ĐIỀU HƯỚNG & CHỐNG SPAM ĐIỂM ---
    document.addEventListener('keydown', (e) => {
        // Chỉ xử lý khi nhấn phím Enter
        if (e.key !== 'Enter') return;

        // Chặn việc giữ phím Enter liên tục (auto-repeat) để không cộng điểm ảo
        if (e.repeat) return;

        // Bỏ qua nếu đang gõ tên ở màn hình chờ
        if (document.activeElement === dom.nameInput) return;

        // Chỉ chạy khi đang ở màn hình làm bài
        if (!dom.quizScreen.classList.contains('hidden')) {
            const currentQuestion = state.activeQuestions[state.currentQuestionIndex];
            if (!currentQuestion) return;

            if (currentQuestion.isAnswered) {
                // Nếu đã trả lời rồi -> Nhấn Enter để sang câu tiếp theo
                handleNextQuestion();
            } else {
                // Nếu chưa trả lời -> Nhấn Enter để bấm nút Kiểm tra đáp án
                const checkBtn = $('fill-in-submit') || 
                               $('multi-check-btn') || 
                               $('match-check-btn') || 
                               $('dropdown-check-btn') || 
                               $('category-check-btn') || 
                               $('order-check-btn');
                
                if (checkBtn && !checkBtn.disabled) {
                    checkBtn.click();
                }
            }
        }
    });
    }

    bindCoreEvents();
    initializeApp();
});
