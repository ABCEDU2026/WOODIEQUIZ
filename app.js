document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // -------------------------------------------------------------------------
    // 1. CONFIG & CONSTANTS
    // -------------------------------------------------------------------------
    const STORAGE_KEYS = { ALL_USERS_DB_KEY: 'quizAppUsers_A80_Stable', LAST_USER_KEY: 'quizAppLastUser_A80', LAST_TOPIC_KEY: 'quizAppLastTopic_A80' };
    const DATABASE_FILES = ['CIE6TW6.json', 'toan6.json', 'IEL90.json', 'periodictable.json', 'cuuchuong3.json'];
    const AI_GURU_URL = 'https://still-fog-44ed.phungtriduc.workers.dev/';
    const AUTO_ADVANCE_DELAY = 1500;
    const NON_AUTO_ADVANCE_TYPES = ['noi', 'nhieu_dap_an', 'sap_xep', 'phan_loai', 'dropdown'];
    const SLOGAN_LIBRARY = ['🚀 Kiến thức là sức mạnh - Level up your brain!', '🌱 Mỗi ngày học một chút, tương lai sáng ngời.', '🔥 Sai thì sửa, đừng ngại thử thách!', '🧠 Nâng cấp bộ não, bão tố cũng qua!'];

    // -------------------------------------------------------------------------
    // 2. STATE MANAGER
    // -------------------------------------------------------------------------
    const state = {
        currentUserName: '', allUsersData: {}, allTopics: [], activeQuestions: [], currentQuestionIndex: 0,
        correctAnswers: 0, incorrectAnswers: 0, currentMode: '', isReviewMode: false, currentQuizTitle: '',
        seenQuestionIds: {}, quizTimer: null, quizSeconds: 0, autoAdvanceTimeout: null, hasQuizEnded: false,
        eliteVoices: [], matchingState: { selectedLeft: null, userMatches: {} }, categorizationState: { draggingTag: null }, speech: { recognition: null }
    };

    // -------------------------------------------------------------------------
    // 3. DOM ELEMENTS
    // -------------------------------------------------------------------------
    const $ = (id) => document.getElementById(id);
    const dom = {
        startScreen: $('start-screen'), quizScreen: $('quiz-screen'), subjectSelector: $('subject-selector'), topicSelector: $('topic-selector'),
        topicTotalQuestions: $('topic-total-questions'), questionText: $('question-text'), optionsContainer: $('options-container'),
        explanationBox: $('explanation-box'), explanationText: $('explanation-text'), readingPassageContainer: $('reading-passage-container'),
        navigationControls: $('navigation-controls'), nextQuestionBtn: $('next-question-btn'), prevQuestionBtn: $('prev-question-btn'),
        stopQuizBtn: $('stop-quiz-btn'), askAiBtn: $('ask-ai-btn'), aiResponseArea: $('ai-response-area'), aiContentText: $('ai-content-text'),
        questionCounter: $('question-counter'), questionNavGrid: $('question-nav-grid'), resultsModal: $('results-modal'), victoryModal: $('victory-modal'),
        nameInput: $('name-input'), slogan: $('daily-slogan'), mobileSubmitBtn: $('mobile-submit-btn'), mobileTimer: $('mob-timer'), mobileProgress: $('mob-progress'),
        dashboardTimer: $('timer-value'), progressBar: $('progress-bar'), correctValue: $('correct-value'), incorrectValue: $('incorrect-value'),
        accuracyValue: $('accuracy-value'), scoreValue: $('score-value'), dashboardCup: $('dash-cup'), dashboardLevel: $('dash-level'),
        userLogList: $('user-log-list'), leaderboardList: $('leaderboard-list'), welcomeUser: $('welcome-user'), welcomePrompt: $('welcome-prompt'),
        userSignature: $('user-signature'), startScreenCups: $('start-screen-cups'), finalScore: $('final-score'), finalAccuracy: $('final-accuracy'),
        finalCorrect: $('final-correct'), finalTotal: $('final-total'), victoryScore: $('victory-score')
    };

    let submitQuizBtn = $('submit-quiz-btn');
    if (!submitQuizBtn && dom.navigationControls) {
        submitQuizBtn = document.createElement('button'); submitQuizBtn.id = 'submit-quiz-btn'; submitQuizBtn.textContent = 'NỘP BÀI';
        submitQuizBtn.className = 'nav-btn primary'; submitQuizBtn.style.display = 'none';
        dom.navigationControls.insertBefore(submitQuizBtn, dom.stopQuizBtn);
    }

    // -------------------------------------------------------------------------
    // 4. SOUND ENGINE & UTILITIES
    // -------------------------------------------------------------------------
    const SoundEngine = {
        ctx: null, init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); },
        playTone({ freq, type = 'sine', duration = 0.1, vol = 0.1, delay = 0 }) {
            try {
                this.init(); const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
                osc.type = type; const startTime = this.ctx.currentTime + delay; osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0, startTime); gain.gain.linearRampToValueAtTime(vol, startTime + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
                osc.connect(gain); gain.connect(this.ctx.destination); osc.start(startTime); osc.stop(startTime + duration);
            } catch (e) { }
        },
        playCorrect() { this.playTone({ freq: 987.77, duration: 0.1, vol: 0.15, type: 'square' }); this.playTone({ freq: 1318.51, duration: 0.3, vol: 0.15, type: 'sine', delay: 0.08 }); },
        playIncorrect() { this.playTone({ freq: 300, duration: 0.35, vol: 0.2, type: 'sawtooth' }); },
        playStart() { [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => this.playTone({ freq: f, duration: 0.15, vol: 0.12, type: 'square', delay: i * 0.08 })); },
        playVictory() { [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77].forEach((f, i) => this.playTone({ freq: f, duration: 0.1, vol: 0.1, delay: i * 0.05 })); }
    };
    function playSound(type) { if (type === 'correct') SoundEngine.playCorrect(); if (type === 'incorrect') SoundEngine.playIncorrect(); if (type === 'start') SoundEngine.playStart(); if (type === 'victory') SoundEngine.playVictory(); }
    function normalizeString(str) { return str ? str.toString().trim().toLowerCase().replace(/\s+/g, ' ') : ''; }
    function shuffleArray(array) { const arr = [...(array||[])]; for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
    function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
    function fixMalformedSVG(html) { return (html||'').replace(/viewBox=([\d\s\.-]+)/g, 'viewBox="$1"').replace(/width=(\d+)/g, 'width="$1"').replace(/height=(\d+)/g, 'height="$1"'); }
    function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
    function showAlert(msg) { window.alert(msg); }

    // -------------------------------------------------------------------------
    // 5. IELTS SPEECH & AUDIO ENGINE
    // -------------------------------------------------------------------------
    function calculateSimilarity(str1, str2) {
        const s1 = normalizeString(str1), s2 = normalizeString(str2); if (s1 === s2) return 100;
        const w1 = s1.split(' ').filter(Boolean), w2 = s2.split(' ').filter(Boolean); if (!w1.length || !w2.length) return 0;
        let m = 0; w1.forEach(w => { if (w2.includes(w)) m++; }); return Math.round((m / Math.max(w1.length, w2.length)) * 100);
    }
    function evaluateSpeakingIELTS(userSpeech, correctText) {
        const s1 = normalizeString(userSpeech), s2 = normalizeString(correctText);
        const w1 = s1.split(' ').filter(Boolean), w2 = s2.split(' ').filter(Boolean);
        let match = 0; w2.forEach(w => { if (w1.includes(w)) match++; });
        const accuracy = Math.round((match / w2.length) * 100);
        const fluency = Math.min(100, Math.round((w1.length / w2.length) * 100));
        let baseScore = (accuracy * 0.7) + (fluency * 0.3);
        const band = Math.min(9.0, (baseScore / 100) * 9).toFixed(1);
        return { accuracy, fluency, band, text: userSpeech };
    }

    let audioCtx = null, analyser = null, dataArray = null, stream = null, animId = null;

    async function initMicVisualizer() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert("Trình duyệt không hỗ trợ hoặc chặn quyền truy cập Microphone.");
                return false;
            }
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            return true;
        } catch (err) {
            console.error("Không thể kết nối Microphone:", err);
            alert("Vui lòng cấp quyền Microphone để thực hiện bài thi nói.");
            return false;
        }
    }

    function drawWaveform() {
        const canvas = $('waveform'); if (!canvas || !analyser) return; const ctx = canvas.getContext('2d'); canvas.height = 50;
        function draw() {
            animId = requestAnimationFrame(draw); analyser.getByteFrequencyData(dataArray); ctx.clearRect(0, 0, canvas.width, canvas.height);
            const grad = ctx.createLinearGradient(0, 0, canvas.width, 0); grad.addColorStop(0, '#6366f1'); grad.addColorStop(1, '#ec4899');
            const bWidth = (canvas.width / dataArray.length) * 2.5; let x = 0;
            for (let i = 0; i < dataArray.length; i++) { const bHeight = (dataArray[i] / 255) * canvas.height; ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(x, canvas.height - bHeight, bWidth - 2, bHeight, 5); ctx.fill(); x += bWidth; }
        }
        draw();
    }
    function stopMicVisualizer() { if (animId) cancelAnimationFrame(animId); if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } if (audioCtx) { audioCtx.close(); audioCtx = null; } }
    
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition; if (SpeechRec) { state.speech.recognition = new SpeechRec(); state.speech.recognition.lang = 'en-US'; }
    function loadEliteVoices() { if ('speechSynthesis' in window) state.eliteVoices = window.speechSynthesis.getVoices(); }
    if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = loadEliteVoices;
    function stopAllTTS() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }

    function playNativeAudio(text) {
        if (!text || !('speechSynthesis' in window)) return; 
        window.speechSynthesis.cancel();
        let cleanText = text.replace(/<[^>]*>/g, '').trim(); 
        const u = new SpeechSynthesisUtterance(cleanText); 
        
        const setVoiceAndSpeak = () => {
            let voices = window.speechSynthesis.getVoices();
            if (voices.length === 0) { setTimeout(setVoiceAndSpeak, 50); return; }
            let bestVoice = voices.find(v => v.name.includes('Google US English')) ||
                            voices.find(v => v.name.includes('Natural') && v.lang.includes('en-US')) ||
                            voices.find(v => v.name.includes('Online') && v.lang.includes('en-US'));
            if (!bestVoice) bestVoice = voices.find(v => v.lang === 'en-US' || v.lang === 'en_US');
            if (!bestVoice) bestVoice = voices.find(v => v.lang.startsWith('en'));
            if (bestVoice) {
                u.voice = bestVoice;
                if (bestVoice.name.includes('Google') || bestVoice.name.includes('Natural')) { u.rate = 0.95; u.pitch = 1.05; } 
                else { u.rate = 1.0; u.pitch = 1.0; }
            } else { u.lang = 'en-US'; }
            window.speechSynthesis.speak(u);
        };
        setVoiceAndSpeak();
    }

    // -------------------------------------------------------------------------
    // 6. DATA PROCESSING
    // -------------------------------------------------------------------------
    async function loadAndParseAllTopics() {
        state.allTopics = [];
        const fetches = DATABASE_FILES.map(f => fetch(f).then(r => r.ok ? r.json() : null).catch(() => null));
        const results = await Promise.all(fetches);
        results.filter(Boolean).forEach(data => {
            if (!Array.isArray(data)) return;
            data.forEach(topic => {
                const qs = (topic.questions || []).map((q, i) => ({ ...q, id: q.id || `${topic.topic}-${i}`, userAnswer: null, isAnswered: false, _isCorrect: null, leftCol: q.leftCol || [], rightCol: q.rightCol || [] }));
                state.allTopics.push({ name: topic.topic || 'Untitled', subject: topic.subject || 'General', questions: qs, originalIndex: state.allTopics.length });
            });
        });
    }

    function prepareQuestionData(question) {
        if (!question) return {}; const q = deepClone(question); q.options = q.options || {};
        if (q.type === 'mot_dap_an' || q.type === 'listening') {
            const keys = Object.keys(q.options), shuffled = shuffleArray(keys), origAns = q.options[q.answer], newMap = {};
            ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, keys.length).forEach((nk, i) => newMap[nk] = q.options[shuffled[i]]);
            q.options = newMap; for (let k in q.options) { if (q.options[k] === origAns) { q.answer = k; break; } }
        } else if (q.type === 'nhieu_dap_an') {
            const keys = Object.keys(q.options), shuffled = shuffleArray(keys), newMap = {}, newAns = [];
            const correctContent = Array.isArray(q.answer) ? q.answer.map(k => q.options[k]) : [];
            ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, keys.length).forEach((nk, i) => { const content = q.options[shuffled[i]]; newMap[nk] = content; if (correctContent.includes(content)) newAns.push(nk); });
            q.options = newMap; q.answer = newAns;
        } else if (q.type === 'noi') {
            q.shuffledRightCol = shuffleArray((q.rightCol || []).map((t, i) => ({ text: t, originalIndex: i })));
        }
        return q;
    }

    // -------------------------------------------------------------------------
    // 7. QUIZ FLOW
    // -------------------------------------------------------------------------
    function startQuiz(mode) {
        const sub = dom.subjectSelector.value, top = dom.topicSelector.value;
        if (!sub) return showAlert('Chọn môn học trước!');
        let title = '', bank = [];
        if (sub.startsWith('comprehensive_')) {
            const sName = sub.replace('comprehensive_', ''); bank = state.allTopics.filter(t => t.subject === sName).reduce((acc, t) => acc.concat(t.questions), []); title = `TỔNG HỢP: ${sName}`;
        } else {
            const tData = state.allTopics[top]; if (tData) { bank = deepClone(tData.questions); title = `${tData.subject} - ${tData.name}`; }
        }
        if (!bank.length) return showAlert('Ngân hàng trống!');

        state.currentMode = mode; 
        state.currentQuizTitle = title;

        const appHeader = $('app-header');
        if (appHeader) {
            appHeader.textContent = title;
            appHeader.classList.remove('hidden');
        }

        let pool = mode === 'random' ? shuffleArray(bank).slice(0, 20) : [...bank];
        
        state.activeQuestions = pool.map(q => prepareQuestionData(q));
        state.currentQuestionIndex = 0; state.correctAnswers = 0; state.incorrectAnswers = 0; state.isReviewMode = false; state.hasQuizEnded = false;
        
        dom.questionNavGrid.innerHTML = '';
        state.activeQuestions.forEach((_, i) => {
            const div = document.createElement('div'); div.className = 'nav-item'; div.id = `nav-item-${i}`; div.textContent = i + 1;
            div.onclick = () => { clearTimeout(state.autoAdvanceTimeout); state.currentQuestionIndex = i; displayQuestion(); };
            dom.questionNavGrid.appendChild(div);
        });

        let banner = $('quiz-topic-banner');
        if (!banner) { 
            banner = document.createElement('div'); 
            banner.id = 'quiz-topic-banner'; 
            banner.className = 'quiz-topic-banner'; 
            const sidebar = document.querySelector('.sidebar'); 
            if (sidebar) sidebar.insertBefore(banner, sidebar.firstChild); 
        }
        banner.innerHTML = `<span class="topic-label">🏷️ CHỦ ĐỀ:</span> <span class="topic-title">${title}</span>`;

        dom.startScreen.classList.add('hidden'); dom.quizScreen.classList.remove('hidden');
        displayQuestion(); startTimer(); updateDashboard(); playSound('start');
    }

    // -------------------------------------------------------------------------
    // 8. TIMERS & UI
    // -------------------------------------------------------------------------
    function startTimer() {
        clearInterval(state.quizTimer); state.quizSeconds = 0;
        if (state.isReviewMode) { if (dom.dashboardTimer) dom.dashboardTimer.textContent = 'Xem lại'; return; }
        state.quizTimer = setInterval(() => {
            state.quizSeconds++;
            if (dom.dashboardTimer) dom.dashboardTimer.textContent = `${String(Math.floor(state.quizSeconds / 60)).padStart(2, '0')}:${String(state.quizSeconds % 60).padStart(2, '0')}`;
        }, 1000);
    }
    function updateQuestionNav(isCorrect) {
        const cur = $(`nav-item-${state.currentQuestionIndex}`);
        if (cur && isCorrect !== undefined) { cur.classList.remove('current'); cur.classList.add(isCorrect ? 'correct' : 'incorrect'); }
        document.querySelectorAll('.nav-item').forEach((it, i) => it.classList.toggle('current', i === state.currentQuestionIndex && isCorrect === undefined));
    }
    function updateDashboard() {
        const nameEl = $('dash-user-name');
        if (nameEl) nameEl.textContent = state.currentUserName || 'Elite Student';

        const total = state.activeQuestions.length, c = state.correctAnswers, ic = state.incorrectAnswers;
        if (dom.correctValue) dom.correctValue.textContent = c;
        if (dom.incorrectValue) dom.incorrectValue.textContent = ic;
        
        const accuracy = total > 0 ? Math.round((c / total) * 100) : 0;
        if (dom.accuracyValue) dom.accuracyValue.textContent = accuracy + '%';
        if (dom.scoreValue) dom.scoreValue.textContent = c * 10;

        const progress = total > 0 ? Math.round(((state.currentQuestionIndex + (state.hasQuizEnded ? 1 : 0)) / total) * 100) : 0;
        if (dom.progressBar) {
            dom.progressBar.style.width = progress + '%';
            dom.progressBar.textContent = progress + '%';
        }
    }

    // -------------------------------------------------------------------------
    // 9. DISPLAY QUESTION DIRECTORY
    // -------------------------------------------------------------------------
    function clearQuestionSurface() { const rA = $('image-render-area'); if (rA) rA.innerHTML = ''; clearTimeout(state.autoAdvanceTimeout); stopAllTTS(); if (dom.aiResponseArea) dom.aiResponseArea.classList.add('hidden'); state.matchingState.selectedLeft = null; state.matchingState.userMatches = {}; dom.optionsContainer.innerHTML = ''; }
    // -------------------------------------------------------------------------
    // 9. DISPLAY QUESTION DIRECTORY
    // -------------------------------------------------------------------------
    function clearQuestionSurface() { 
        const rA = $('image-render-area'); if (rA) rA.innerHTML = ''; 
        clearTimeout(state.autoAdvanceTimeout); 
        stopAllTTS(); 
        
        // =========================================================================
        // [A90 ELITE VÁ LỖI]: TRIỆT TIÊU MICROPHONE RÒ RỈ SANG MODAL KẾT THÚC
        // =========================================================================
        if (typeof stopMicVisualizer === 'function') {
            stopMicVisualizer(); // Ngắt luồng ghi âm và triệt tiêu animation canvas waveform ngay lập tức
        }
        
        if (dom.aiResponseArea) dom.aiResponseArea.classList.add('hidden'); 
        state.matchingState.selectedLeft = null; 
        state.matchingState.userMatches = {}; 
        dom.optionsContainer.innerHTML = ''; 
    }
    function displayQuestion() {
        clearQuestionSurface(); updateQuestionNav();
        const q = state.activeQuestions[state.currentQuestionIndex]; if (!q) return;
        if (q.type === 'noi' && q.userAnswer) state.matchingState.userMatches = { ...q.userAnswer };
        const qType = (q.type || 'mot_dap_an').toLowerCase();
        
        if (dom.questionCounter) dom.questionCounter.textContent = `Câu ${state.currentQuestionIndex + 1} / ${state.activeQuestions.length}`;
        if (qType === 'dropdown') { dom.questionText.style.display = 'none'; dom.questionText.innerHTML = ''; }
        else { dom.questionText.style.display = 'block'; dom.questionText.innerHTML = fixMalformedSVG(q.question || ''); }

        switch (qType) {
            case 'speaking': renderSpeaking(q); break;
            case 'listening': renderListening(q); break;
            case 'noi': renderMatching(q); break;
            case 'dien_khuyet': renderFillInTheBlank(q); break;
            case 'phan_loai': renderCategorization(q); break;
            case 'sap_xep': renderOrdering(q); break;
            case 'nhieu_dap_an': renderMultiResponse(q); break;
            case 'dropdown': renderDropdown(q); break;
            case 'dung_sai': renderTrueFalse(q); break;
            default: renderMultipleChoice(q); break;
        }

        if (q.isAnswered || state.isReviewMode) showAnswerState(q); else dom.explanationBox.classList.add('hidden');
        if (window.MathJax) MathJax.typesetPromise([dom.questionText, dom.optionsContainer, dom.explanationBox]).catch(() => {});

        const imgWin = $('image-side-window'), rArea = $('image-render-area');
        if (imgWin && rArea) {
            let allImgs = [];
            if (dom.questionText && dom.questionText.style.display !== 'none') { allImgs = [...allImgs, ...dom.questionText.querySelectorAll('img, svg')]; }
            const dropdownArea = dom.optionsContainer.querySelector('.dropdown-question-text');
            if (dropdownArea) { allImgs = [...allImgs, ...dropdownArea.querySelectorAll('img, svg')]; }

            if (allImgs.length > 0) {
                rArea.innerHTML = ''; 
                allImgs.forEach(img => { const clone = img.cloneNode(true); rArea.appendChild(clone); img.style.display = 'none'; });
                imgWin.classList.remove('hidden');
            } else { imgWin.classList.add('hidden'); }
        }

        if (qType === 'noi') setTimeout(() => { if (typeof drawMatchingLines === 'function') drawMatchingLines(q.isAnswered || state.isReviewMode); }, 250);
    }

    // --- RENDER DẠNG CÂU HỎI ---
    function createOptionButton(key, content, onClick, disabled) {
        const b = document.createElement('button'); b.className = 'option'; b.dataset.answer = key;
        b.innerHTML = `<strong>${key.toUpperCase()}.</strong> ${content}`; b.disabled = disabled;
        if (!disabled && onClick) b.onclick = onClick; return b;
    }
    
    function renderMultipleChoice(q) { 
        if (!q.options) return; 
        Object.keys(q.options).sort().forEach(k => dom.optionsContainer.appendChild(createOptionButton(k, q.options[k], () => selectAnswer(k), q.isAnswered || state.isReviewMode))); 
    }
    
    function renderListening(q) {
        dom.optionsContainer.innerHTML = `
            <div class="elite-audio-card">
                <div class="audio-icon-wrapper"><svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18.03,19.86 21,16.28 21,12C21,7.72 18.03,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16.04C15.5,15.29 16.5,13.77 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/></svg></div>
                <div class="audio-controls">
                    <button id="play-audio-btn" class="elite-play-btn">🎧 LISTEN NOW</button>
                    <p class="audio-hint">Native Speaker 9.0 Curriculum</p>
                </div>
            </div>
            <div id="listen-opts" class="options-grid"></div>`;
        
        $('play-audio-btn').onclick = () => playNativeAudio(q.audio_text || q.question);
        const w = $('listen-opts'); 
        Object.keys(q.options || {}).sort().forEach(k => w.appendChild(createOptionButton(k, q.options[k], () => selectAnswer(k), q.isAnswered || state.isReviewMode)));
    }
    
    function renderSpeaking(q) {
        if (!q.attempts) q.attempts = 0;
        dom.optionsContainer.innerHTML = `
        <div class="elite-speaking-card">
            <div class="speaking-header">
                <span class="ielts-badge">IELTS SPEAKING TASK</span>
                <span class="attempt-count">Attempt: ${q.attempts}/3</span>
            </div>
            <div class="speaking-target">
                <p class="target-label">Target Sentence:</p>
                <p class="target-text">"${escapeHtml(q.answer || '')}"</p>
                <button id="play-model-speech" class="play-prompt-btn">🔊 Listen to Model</button>
            </div>
            <div class="speaking-action-area">
                <div class="mic-wrapper" id="mic-wrap">
                    <button id="speak-btn" class="elite-mic-btn">🎙️</button>
                    <div class="pulse-ring"></div>
                </div>
                <p id="status-text" class="status-text">Sẵn sàng ghi âm</p>
                <canvas id="waveform" class="elite-waveform" width="350" height="50"></canvas>
            </div>
            <div id="speaking-feedback" class="hidden"></div>
        </div>`;

        $('play-model-speech').onclick = () => playNativeAudio(q.answer);
        $('speak-btn').onclick = async () => {
            const rec = state.speech.recognition; if (!rec) return;
            const ok = await initMicVisualizer(); if (!ok) return;
            drawWaveform();
            $('mic-wrap').classList.add('recording');
            $('status-text').textContent = "🔴 LISTENING...";
            $('status-text').classList.add('recording-text');
            
            rec.onresult = (e) => {
                const txt = e.results[0][0].transcript; q.attempts++;
                const res = evaluateSpeakingIELTS(txt, q.answer);
                showSpeakingFeedback(res, q);
            };
            rec.onend = () => { $('mic-wrap').classList.remove('recording'); stopMicVisualizer(); };
            rec.start();
        };
    }

    function showSpeakingFeedback(res, q) {
        const fb = $('speaking-feedback'); if (!fb) return;
        fb.classList.remove('hidden');
        fb.innerHTML = `
            <div class="speaking-result">
                <p class="transcript-text">You said: "<i>${res.text}</i>"</p>
                <div class="score-row">
                    <div class="score-badge">BAND ${res.band}</div>
                    <div class="sub-stats">
                        <span>Accuracy: ${res.accuracy}%</span>
                        <span>Fluency: ${res.fluency}%</span>
                    </div>
                </div>
            </div>`;

        if (res.accuracy >= 80) {
            q.isAnswered = true; q._isCorrect = true;
            const st = $('status-text'); if (st) { st.textContent = "🎉 XUẤT SẮC! ĐANG TỰ ĐỘNG CHUYỂN CÂU..."; st.style.color = "var(--correct-color)"; st.classList.remove('recording-text'); }
            finalizeAnswer(true, q);
        } else if (q.attempts >= 3) {
            q.isAnswered = true; q._isCorrect = false;
            const st = $('status-text'); if (st) { st.textContent = "❌ HẾT LƯỢT THỬ! ĐANG CHUYỂN CÂU TIẾP THEO..."; st.style.color = "var(--incorrect-color)"; st.classList.remove('recording-text'); }
            finalizeAnswer(false, q);
        } else {
            q.isAnswered = false;
            const st = $('status-text'); if (st) { st.textContent = `🔁 Chưa đạt chuẩn 80% (Lượt ${q.attempts}/3). Hãy bấm để thử lại!`; st.style.color = "var(--hint-color)"; st.classList.remove('recording-text'); }
        }
    }

    function renderMultiResponse(q) {
        dom.optionsContainer.innerHTML = '<p style="font-weight:bold; margin-bottom:10px; color:#64748b;">(Có thể chọn nhiều đáp án đúng)</p><div id="multi-opts" style="display:grid;gap:15px;width:100%"></div>'; 
        const optsContainer = $('multi-opts');
        const chk = document.createElement('button'); chk.id = 'multi-check-btn'; chk.className = 'nav-btn'; chk.textContent = 'Kiểm tra'; chk.style.marginTop = "15px";
        Object.keys(q.options || {}).sort().forEach(k => { 
            const b = createOptionButton(k, q.options[k], null, q.isAnswered || state.isReviewMode); 
            if (q.isAnswered || state.isReviewMode) { if (q.userAnswer?.includes(k)) b.classList.add('selected'); } 
            else { b.onclick = () => { b.classList.toggle('selected'); chk.disabled = !optsContainer.querySelector('.selected'); }; } 
            optsContainer.appendChild(b); 
        });
        if (!q.isAnswered && !state.isReviewMode) { chk.disabled = true; chk.onclick = checkMultiResponseAnswer; dom.optionsContainer.appendChild(chk); }
    }
    
    function renderTrueFalse(q) {
        dom.optionsContainer.innerHTML = '<div class="tf-button-container" style="display:grid; grid-template-columns:1fr 1fr; gap:20px;"><button class="option tf-btn" data-answer="dung" style="text-align:center;">ĐÚNG</button><button class="option tf-btn" data-answer="sai" style="text-align:center;">SAI</button></div>';
        if (!q.isAnswered && !state.isReviewMode) dom.optionsContainer.querySelectorAll('button').forEach(b => b.onclick = () => selectAnswer(b.dataset.answer));
    }
    
    function renderFillInTheBlank(q) {
        const val = q.userAnswer || ''; 
        dom.optionsContainer.innerHTML = `
            <div style="width: 100%; margin-bottom: 20px;">
                <input type="text" id="fill-in-input" class="option" placeholder="Nhập đáp án bằng số vào đây..." value="${val.replace(/"/g, '&quot;')}" style="width: 100%; text-align: center; font-size: 1.6rem; font-weight: 900; border: 3px solid var(--primary-color);">
            </div>
            <button id="fill-in-submit" class="nav-btn">Kiểm tra</button>
        `;
        const inp = $('fill-in-input'), btn = $('fill-in-submit');
        if (!q.isAnswered && !state.isReviewMode) { 
            btn.disabled = true; inp.oninput = () => btn.disabled = !inp.value.trim(); btn.onclick = () => selectAnswer(inp.value); 
            inp.onkeypress = e => { if (e.key === 'Enter' && !btn.disabled) selectAnswer(inp.value); }; setTimeout(() => inp.focus(), 100); 
        } else { inp.disabled = true; btn.style.display = 'none'; }
    }
    
    function renderDropdown(q) {
        q.correctDropdowns = []; 
        const html = (q.question || '').replace(/\[\[(.*?)\]\]/g, (_, c) => { 
            const opts = c.split('|'); q.correctDropdowns.push(opts[0]); 
            let s = '<select class="dropdown-select"><option value="">...</option>'; 
            shuffleArray(opts).forEach(o => s += `<option value="${o.replace(/"/g, '&quot;')}">${o}</option>`); return s + '</select>'; 
        });
        dom.optionsContainer.innerHTML = `<div class="dropdown-question-text" style="font-size:1.3rem; line-height:2;">${html}</div>`;
        
        if (!q.isAnswered && !state.isReviewMode) { 
            const chk = document.createElement('button'); chk.id = 'dropdown-check-btn'; chk.className = 'nav-btn'; chk.textContent = 'Kiểm tra'; chk.disabled = true; chk.style.marginTop = "20px";
            dom.optionsContainer.appendChild(chk); 
            const sels = dom.optionsContainer.querySelectorAll('select'); 
            sels.forEach(s => s.onchange = () => chk.disabled = Array.from(sels).some(x => !x.value)); chk.onclick = checkDropdownAnswer; 
        } else if (q.userAnswer) { 
            dom.optionsContainer.querySelectorAll('select').forEach((s, i) => { s.value = q.userAnswer[i] || ''; s.disabled = true; s.classList.add(s.value === q.correctDropdowns[i] ? 'correct' : 'incorrect'); }); 
        }
    }
    
    function renderCategorization(q) {
        let gH = '', tH = ''; (q.nhom || []).forEach((n, i) => gH += `<div class="category-group-box" data-group-index="${i}"><h4>${n}</h4></div>`); shuffleArray(q.the || []).forEach(t => tH += `<div class="category-tag" draggable="true" data-tag-text="${t.replace(/"/g, '&quot;')}">${t}</div>`);
        dom.optionsContainer.innerHTML = `<div class="categorization-container"><div class="category-groups">${gH}</div><div class="category-tags-pool">${tH}</div></div><button id="category-check-btn" class="nav-btn">Kiểm tra</button>`;
        const chk = $('category-check-btn'); if (!q.isAnswered && !state.isReviewMode) { chk.disabled = true; chk.onclick = checkCategorizationAnswer; setupDragAndDrop(chk); } else { chk.style.display = 'none'; }
    }
    
    function renderOrdering(q) {
        const items = (q.isAnswered || state.isReviewMode) ? (q.userAnswer || []) : shuffleArray(q.muc || []); let html = ''; items.forEach(t => html += `<li class="ordering-item" draggable="true" data-text="${t.replace(/"/g, '&quot;')}">${t.replace(/^(\(\d+\)|\d+[\.\/])\s*/, '')}</li>`);
        dom.optionsContainer.innerHTML = `<ul id="ordering-list" class="ordering-container">${html}</ul><button id="order-check-btn" class="nav-btn" style="margin-top:15px">Kiểm tra</button>`;
        const chk = $('order-check-btn'); if (!q.isAnswered && !state.isReviewMode) { chk.disabled = true; chk.onclick = checkOrderingAnswer; setupOrderingDrag(chk); } else chk.style.display = 'none';
    }

    function renderMatching(q) {
        let lH = '', rH = ''; (q.leftCol || []).forEach((t, i) => lH += `<div class="match-item" data-match-id="left-${i}">${t}</div>`); (q.shuffledRightCol || []).forEach(t => rH += `<div class="match-item" data-match-id="right-${t.originalIndex}">${t.text}</div>`);
        dom.optionsContainer.innerHTML = `<div id="matching-container"><svg id="matching-svg-canvas"></svg><div id="matching-col-left">${lH}</div><div id="matching-col-right">${rH}</div></div><button id="match-check-btn" class="nav-btn">Kiểm tra</button>`;
        const chk = $('match-check-btn'); if (!q.isAnswered && !state.isReviewMode) { chk.disabled = true; chk.onclick = checkMatchingAnswer; document.querySelectorAll('.match-item').forEach(i => i.onclick = handleMatchClick); } else { chk.style.display = 'none'; document.querySelectorAll('.match-item').forEach(i => i.style.pointerEvents = 'none'); }
    }

    // -------------------------------------------------------------------------
    // 10. INTERACTION HELPERS (Drag-Drop, Match)
    // -------------------------------------------------------------------------
    function handleMatchClick(e) {
        const item = e.target.closest('.match-item'); if (!item) return; const id = item.dataset.matchId;
        if (item.classList.contains('matched')) { let leftKey = id.startsWith('left-') ? id : Object.keys(state.matchingState.userMatches).find(k => state.matchingState.userMatches[k] === id); if (leftKey) { delete state.matchingState.userMatches[leftKey]; updateMatchingClasses(); drawMatchingLines(false); $('match-check-btn').disabled = !Object.keys(state.matchingState.userMatches).length; } return; }
        if (id.startsWith('left-')) { if (state.matchingState.selectedLeft) state.matchingState.selectedLeft.classList.remove('selected'); state.matchingState.selectedLeft = item; item.classList.add('selected'); } 
        else if (state.matchingState.selectedLeft) { state.matchingState.userMatches[state.matchingState.selectedLeft.dataset.matchId] = id; state.matchingState.selectedLeft.classList.remove('selected'); state.matchingState.selectedLeft = null; updateMatchingClasses(); drawMatchingLines(false); $('match-check-btn').disabled = false; }
    }
    function updateMatchingClasses() { document.querySelectorAll('.match-item').forEach(e => e.classList.remove('matched')); for (let l in state.matchingState.userMatches) { const eL = document.querySelector(`[data-match-id="${l}"]`), eR = document.querySelector(`[data-match-id="${state.matchingState.userMatches[l]}"]`); if (eL) eL.classList.add('matched'); if (eR) eR.classList.add('matched'); } }
    function drawMatchingLines(isRev) {
        const svg = $('matching-svg-canvas'), c = $('matching-container'); if (!svg || !c) return; const r = c.getBoundingClientRect(); svg.setAttribute('width', r.width); svg.setAttribute('height', r.height); svg.innerHTML = '';
        for (let l in state.matchingState.userMatches) renderLine(svg, l, state.matchingState.userMatches[l], r, isRev, false);
        if (isRev) { const q = state.activeQuestions[state.currentQuestionIndex]; if (q && q.leftCol) q.leftCol.forEach((_, i) => { if (state.matchingState.userMatches[`left-${i}`] !== `right-${i}`) renderLine(svg, `left-${i}`, `right-${i}`, r, false, true); }); }
    }
    function renderLine(svg, lid, rid, cR, isRev, isHint) {
        const lE = document.querySelector(`[data-match-id="${lid}"]`), rE = document.querySelector(`[data-match-id="${rid}"]`); if (!lE || !rE) return;
        const lR = lE.getBoundingClientRect(), rR = rE.getBoundingClientRect(), line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', lR.right - cR.left); line.setAttribute('y1', lR.top - cR.top + lR.height / 2); line.setAttribute('x2', rR.left - cR.left); line.setAttribute('y2', rR.top - cR.top + rR.height / 2);
        if (isHint) line.classList.add('hint-line'); else if (isRev) line.classList.add(lid.split('-')[1] === rid.split('-')[1] ? 'correct-line' : 'incorrect-line'); else line.classList.add('pending'); svg.appendChild(line);
    }
    function setupDragAndDrop(checkBtn) {
        document.querySelectorAll('.category-tag').forEach(tag => { tag.addEventListener('dragstart', () => { setTimeout(() => tag.classList.add('dragging'), 0); state.categorizationState.draggingTag = tag; }); tag.addEventListener('dragend', () => { tag.classList.remove('dragging'); state.categorizationState.draggingTag = null; const pool = document.querySelector('.category-tags-pool'); checkBtn.disabled = pool && pool.children.length > 0; }); });
        document.querySelectorAll('.category-group-box, .category-tags-pool').forEach(zone => { zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); }); zone.addEventListener('dragleave', () => zone.classList.remove('drag-over')); zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); if (state.categorizationState.draggingTag) zone.appendChild(state.categorizationState.draggingTag); }); });
    }
    function setupOrderingDrag(checkBtn) {
        const list = document.getElementById('ordering-list'); if (!list) return;
        list.querySelectorAll('.ordering-item').forEach(item => { item.addEventListener('dragstart', () => setTimeout(() => item.classList.add('dragging'), 0)); item.addEventListener('dragend', () => { item.classList.remove('dragging'); checkBtn.disabled = false; }); });
        list.addEventListener('dragover', e => { e.preventDefault(); const draggingItem = document.querySelector('.dragging'); if (!draggingItem) return; const siblings = [...list.querySelectorAll('.ordering-item:not(.dragging)')]; let nextSibling = siblings.find(sibling => e.clientY <= sibling.getBoundingClientRect().top + sibling.offsetHeight / 2); list.insertBefore(draggingItem, nextSibling); });
    }

    // -------------------------------------------------------------------------
    // 11. CHECKING & FINALIZING ANSWERS
    // -------------------------------------------------------------------------
    function selectAnswer(uSel) { const q = state.activeQuestions[state.currentQuestionIndex]; if (!q || q.isAnswered) return; q.isAnswered = true; q.userAnswer = uSel; q._isCorrect = q.type === 'dien_khuyet' ? normalizeString(uSel) === normalizeString(q.answer) : uSel === q.answer; finalizeAnswer(q._isCorrect, q); }
    function checkDropdownAnswer() { const q = state.activeQuestions[state.currentQuestionIndex]; const ss = dom.optionsContainer.querySelectorAll('select'); const ans = Array.from(ss).map(s => s.value); let c = true; ans.forEach((a, i) => { if (a !== q.correctDropdowns[i]) c = false; }); q.isAnswered = true; q.userAnswer = ans; q._isCorrect = c; ss.forEach((s, i) => { s.disabled = true; s.classList.add(s.value === q.correctDropdowns[i] ? 'correct' : 'incorrect'); }); finalizeAnswer(c, q); }
    function checkMultiResponseAnswer() { const q = state.activeQuestions[state.currentQuestionIndex]; const sel = Array.from(dom.optionsContainer.querySelectorAll('.selected')).map(b => b.dataset.answer); q.isAnswered = true; q.userAnswer = sel; q._isCorrect = JSON.stringify(sel.sort()) === JSON.stringify((q.answer || []).sort()); finalizeAnswer(q._isCorrect, q); }
    function checkMatchingAnswer() { const q = state.activeQuestions[state.currentQuestionIndex]; let c = 0; for (let [l, r] of Object.entries(state.matchingState.userMatches)) if (l.split('-')[1] === r.split('-')[1]) c++; q.isAnswered = true; q.userAnswer = { ...state.matchingState.userMatches }; q._isCorrect = (c === q.leftCol.length && Object.keys(q.userAnswer).length === q.leftCol.length); finalizeAnswer(q._isCorrect, q); }
    function checkCategorizationAnswer() { const q = state.activeQuestions[state.currentQuestionIndex]; const userAns = {}; let isCorrect = true; document.querySelectorAll('.category-tag').forEach(tag => { const text = tag.dataset.tagText; const parent = tag.closest('.category-group-box'); const gIdx = parent ? parseInt(parent.dataset.groupIndex) : -1; userAns[text] = gIdx; if (q.answer && q.answer[text] !== gIdx) isCorrect = false; }); q.isAnswered = true; q.userAnswer = userAns; q._isCorrect = isCorrect; finalizeAnswer(isCorrect, q); }
    function checkOrderingAnswer() { const q = state.activeQuestions[state.currentQuestionIndex]; const userAns = [...document.querySelectorAll('.ordering-item')].map(item => item.dataset.text); const isCorrect = JSON.stringify(userAns) === JSON.stringify(q.answer || q.muc); q.isAnswered = true; q.userAnswer = userAns; q._isCorrect = isCorrect; finalizeAnswer(isCorrect, q); }

    function finalizeAnswer(isCor, q) {
        if (isCor) { state.correctAnswers++; playSound('correct'); } else { state.incorrectAnswers++; playSound('incorrect'); } updateQuestionNav(isCor);
        setTimeout(() => { showAnswerState(q); updateDashboard(); if (state.currentQuestionIndex < state.activeQuestions.length - 1 && !NON_AUTO_ADVANCE_TYPES.includes(q.type)) state.autoAdvanceTimeout = setTimeout(handleNextQuestion, AUTO_ADVANCE_DELAY); }, 100);
    }
    function showAnswerState(q) {
        dom.explanationBox.classList.remove('hidden'); 
        dom.explanationText.innerHTML = q.explanation ? fixMalformedSVG(q.explanation) : 'Không có giải thích chi tiết.';
        const qType = (q.type || 'mot_dap_an').toLowerCase();

        dom.optionsContainer.querySelectorAll('.option:not(input)').forEach(b => {
            const k = b.dataset.answer; if (!k) return; 
            const isM = Array.isArray(q.answer), c = isM ? q.answer.includes(k) : q.answer === k, u = isM ? q.userAnswer?.includes(k) : q.userAnswer === k;
            if (c) b.classList.add('correct', 'highlighted'); if (u && !c) b.classList.add('incorrect', 'highlighted');
        });
        
        if (qType === 'dien_khuyet') { const i = $('fill-in-input'); if (i) i.classList.add(q._isCorrect ? 'correct' : 'incorrect', 'highlighted'); }
        if (qType === 'noi') { 
            drawMatchingLines(true); 
            for (let l in state.matchingState.userMatches) { 
                const r = state.matchingState.userMatches[l], eL = document.querySelector(`[data-match-id="${l}"]`), eR = document.querySelector(`[data-match-id="${r}"]`), c = l.split('-')[1] === r.split('-')[1]; 
                if (eL) { eL.classList.remove('matched'); eL.classList.add(c ? 'correct' : 'incorrect'); } if (eR) { eR.classList.remove('matched'); eR.classList.add(c ? 'correct' : 'incorrect'); } 
            } 
        }
        if (qType === 'dropdown' && q.correctDropdowns) { dom.optionsContainer.querySelectorAll('select').forEach((s, i) => { s.disabled = true; s.classList.add(s.value === q.correctDropdowns[i] ? 'correct' : 'incorrect'); }); }
        if (qType === 'sap_xep') {
            const targetOrder = q.answer || q.muc;
            dom.optionsContainer.querySelectorAll('.ordering-item').forEach((item, i) => { item.setAttribute('draggable', 'false'); item.classList.add(item.dataset.text === targetOrder[i] ? 'correct' : 'incorrect'); });
        }
        if (qType === 'phan_loai' && q.answer) {
            dom.optionsContainer.querySelectorAll('.category-tag').forEach(tag => { tag.setAttribute('draggable', 'false'); const parent = tag.closest('.category-group-box'); const gIdx = parent ? parseInt(parent.dataset.groupIndex) : -1; tag.classList.add(q.answer[tag.dataset.tagText] === gIdx ? 'correct' : 'incorrect'); });
        }
    }

    // -------------------------------------------------------------------------
    // 12. END QUIZ & NAVIGATION BINDINGS
    // -------------------------------------------------------------------------
    function handleNextQuestion() { if (state.currentQuestionIndex < state.activeQuestions.length - 1) { state.currentQuestionIndex++; displayQuestion(); } else if (!state.isReviewMode) endQuiz(); }
    function handlePrevQuestion() { if (state.currentQuestionIndex > 0) { state.currentQuestionIndex--; displayQuestion(); } }
    
    function endQuiz() { 
        clearInterval(state.quizTimer); state.hasQuizEnded = true; 
        const score = state.correctAnswers, total = state.activeQuestions.length, acc = total > 0 ? Math.round((score / total) * 100) : 0; 
        
        if (state.currentUserName && state.allUsersData[state.currentUserName]) {
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            state.allUsersData[state.currentUserName].logs.push({
                date: timeStr,
                topic: state.currentQuizTitle || 'Bài kiểm tra tổng hợp',
                score: `${score}/${total}`,
                acc: acc
            });
            state.allUsersData[state.currentUserName].score += score * 10;
            if (acc >= 90) state.allUsersData[state.currentUserName].cups += 1;
            localStorage.setItem(STORAGE_KEYS.ALL_USERS_DB_KEY, JSON.stringify(state.allUsersData));
        }

        if (dom.finalScore) dom.finalScore.textContent = score * 10; 
        if (dom.finalCorrect) dom.finalCorrect.textContent = score; 
        if (dom.finalTotal) dom.finalTotal.textContent = total; 
        if (dom.finalAccuracy) dom.finalAccuracy.textContent = acc + '%'; 
        
        if (acc >= 80) { dom.victoryModal.classList.remove('hidden'); if (dom.victoryScore) dom.victoryScore.textContent = score * 10; playSound('victory'); } 
        else dom.resultsModal.classList.remove('hidden'); 
    }

    function resetQuizView() { 
        dom.quizScreen.classList.add('hidden'); 
        dom.startScreen.classList.remove('hidden'); 
        dom.resultsModal.classList.add('hidden'); 
        dom.victoryModal.classList.add('hidden'); 
        $('app-header')?.classList.add('hidden');
        renderStatsAndLogs();
    }
    function startReviewMode() { state.isReviewMode = true; state.currentQuestionIndex = 0; dom.resultsModal.classList.add('hidden'); dom.victoryModal.classList.add('hidden'); displayQuestion(); updateDashboard(); }

    // -------------------------------------------------------------------------
    // 13. PRINT FUNCTIONS (MÔ HÌNH CÁCH LY WINDOW)
    // -------------------------------------------------------------------------
    function printSummaryReportCard() {
        const studentName = state.currentUserName || 'Học viên Elite';
        const user = state.allUsersData[studentName] || {};
        const logs = user.logs || [];
        const cups = user.cups || 0;
        const totalCompleted = logs.length;
        
        let avgAccuracy = 0;
        if (totalCompleted > 0) {
            const sumAccuracy = logs.reduce((acc, log) => acc + parseFloat(log.acc || 0), 0);
            avgAccuracy = Math.round(sumAccuracy / totalCompleted);
        }
        const now = new Date();
        const dateStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

        let tableRowsHtml = '';
        if (totalCompleted === 0) {
            tableRowsHtml = `<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:20px;">Chưa ghi nhận dữ liệu bài kiểm tra nào trên hệ thống.</td></tr>`;
        } else {
            [...logs].reverse().forEach(log => {
                tableRowsHtml += `
                    <tr>
                        <td style="font-weight: bold; color: #475569;">${log.date || dateStr}</td>
                        <td style="font-weight: 800; color: #1e3a8a; text-transform: uppercase;">${log.topic || 'Chuyên đề học tập'}</td>
                        <td style="text-align: center; font-weight: 900; color: #b45309;">${log.score || '0'}</td>
                        <td style="text-align: center; font-weight: 900; color: #10b981;">${log.acc}%</td>
                    </tr>`;
            });
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <title>Bảng Vàng Thành Tích - ${studentName}</title>
                <style>
                    @page { size: A4; margin: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .report-container { background: #ffffff; border-top: 16px solid #b45309; padding: 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-radius: 16px; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px double #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
                    .brand-logo { color: #b45309; font-size: 28px; font-weight: 900; letter-spacing: 1px; }
                    .brand-subtitle { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-top: 2px; }
                    .report-type h1 { margin: 0; font-size: 24px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; text-align: right; }
                    .meta-box { background: #fffbeb; border-left: 6px solid #f59e0b; padding: 20px; border-radius: 8px; margin-bottom: 35px; font-size: 15px; }
                    .meta-line { margin-bottom: 6px; color: #475569; font-weight: 600; }
                    .meta-line strong { color: #0f172a; font-size: 17px; }
                    .stats-grid { display: flex; gap: 20px; margin-bottom: 35px; }
                    .stat-card { flex: 1; background: #ffffff; border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; }
                    .stat-card.highlight { background: #fffbeb; border-color: #fde68a; }
                    .stat-label { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 8px; letter-spacing: 0.5px; }
                    .stat-number { font-size: 32px; font-weight: 900; color: #0f172a; }
                    .text-medal { color: #d97706; }
                    .table-section h3 { font-size: 15px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
                    .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    .data-table th { background-color: #1e3a8a; color: #ffffff; font-weight: 800; text-transform: uppercase; font-size: 12px; padding: 12px 10px; text-align: left; }
                    .data-table td { padding: 14px 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
                    .data-table tr:nth-child(even) { background-color: #f8fafc; }
                    .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; font-style: italic; }
                </style>
            </head>
            <body>
                <div class="report-container">
                    <div class="header">
                        <div>
                            <div class="brand-logo">🏆 A90 ACADEMIC</div>
                            <div class="brand-subtitle">Hệ thống Đánh giá Năng lực Chuẩn Ivy League</div>
                        </div>
                        <div class="report-type"><h1>BẢNG VÀNG THÀNH TÍCH</h1></div>
                    </div>
                    <div class="meta-box">
                        <div class="meta-line">Học giả vinh danh: <strong>${studentName}</strong></div>
                        <div class="meta-line">Thời gian xuất báo cáo: <span>${dateStr}</span></div>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-card"><div class="stat-label">Bài Đã Hoàn Thành</div><div class="stat-number">${totalCompleted}</div></div>
                        <div class="stat-card"><div class="stat-label">Độ Chính Xác TB</div><div class="stat-number" style="color:#10b981;">${avgAccuracy}%</div></div>
                        <div class="stat-card highlight"><div class="stat-label">Cúp Danh Giá</div><div class="stat-number text-medal">🏆 ${cups}</div></div>
                    </div>
                    <div class="table-section">
                        <h3>📜 Nhật ký tiến độ kiểm tra chi tiết</h3>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width: 25%;">Thời gian thi</th>
                                    <th style="width: 45%;">Nội dung bài kiểm tra</th>
                                    <th style="width: 15%; text-align: center;">Điểm số</th>
                                    <th style="width: 15%; text-align: center;">Tỷ lệ</th>
                                </tr>
                            </thead>
                            <tbody>${tableRowsHtml}</tbody>
                        </table>
                    </div>
                    <div class="footer">Báo cáo được trích xuất tự động từ Hệ thống Đánh giá Năng lực Chuẩn Ivy League (A90).</div>
                </div>
            </body>
            </html>`;

        const printWindow = window.open('', '_blank', 'width=950,height=900');
        if (!printWindow) { return alert('Vui lòng mở chặn Popup để in bảng vàng thành tích!'); }
        printWindow.document.open(); printWindow.document.write(htmlContent); printWindow.document.close();
        printWindow.onload = function() { printWindow.focus(); printWindow.print(); setTimeout(() => { printWindow.close(); }, 400); };
    }

    function printEliteReportCard() {
        const now = new Date();
        const dateStr = `${now.toLocaleDateString('vi-VN')} ${now.toLocaleTimeString('vi-VN')}`;
        const studentName = state.currentUserName || 'Học viên Elite';
        const total = (state.activeQuestions && state.activeQuestions.length) ? state.activeQuestions.length : 0;
        
        let topicTitle = state.currentQuizTitle || 'Bài đánh giá năng lực tổng hợp';
        let totalStr, correctStr, incorrectStr, accuracyStr, evaluationText;

        if (total === 0) {
            topicTitle = "Báo Cáo Tiến Độ Học Tập Tổng Quát";
            const user = state.allUsersData[studentName] || {};
            const logs = user.logs || [];
            const cups = user.cups || 0;
            if (logs.length > 0) {
                const lastLog = logs[logs.length - 1];
                totalStr = "---"; correctStr = "---"; incorrectStr = "---"; accuracyStr = lastLog.acc + '%';
                evaluationText = `Dữ liệu hệ thống ghi nhận năng lực hiện tại đạt mức **${lastLog.acc}%** ở chuyên đề gần nhất: [${lastLog.topic}]. Tổng số danh hiệu học thuật đã xác thực: **🏆 ${cups} Cúp**. Lộ trình học tập đang diễn ra đúng tiến độ.`;
            } else {
                totalStr = "0"; correctStr = "0"; incorrectStr = "0"; accuracyStr = "0%";
                evaluationText = "Chưa có dữ liệu bài làm nào được ghi nhận trên hệ thống đối với học viên này.";
            }
        } else {
            const correct = state.correctAnswers || 0;
            const incorrectOrSkipped = total - correct;
            const acc = Math.round((correct / total) * 100);
            totalStr = total; correctStr = correct; incorrectStr = incorrectOrSkipped; accuracyStr = acc + '%';
            
            if (acc >= 90) evaluationText = "ĐÁNH GIÁ CHUYÊN MÔN: Học viên thể hiện sự xuất sắc trong việc làm chủ các khái niệm cốt lõi. Khả năng tư duy logic và phản xạ chính xác tuyệt đối. Khuyến nghị: Chuyển sang lộ trình nghiên cứu độc lập và giải quyết các bài toán phức hợp.";
            else if (acc >= 75) evaluationText = "ĐÁNH GIÁ CHUYÊN MÔN: Năng lực phân tích tốt. Đã nắm vững cấu trúc lý thuyết nền tảng. Các lỗi sai chủ yếu xuất phát từ sự sơ suất nhất thời. Khuyến nghị: Sử dụng chế độ 'Làm lại câu sai' để vá các lỗ hổng nhỏ.";
            else if (acc >= 50) evaluationText = "ĐÁNH GIÁ CHUYÊN MÔN: Mức độ đọc hiểu ở mức trung bình. Nắm được cơ chế cơ bản nhưng thiếu sự gắn kết cấu trúc logic sâu. Khuyến nghị: Đọc kỹ phần 'Giải thích chi tiết' và hệ thống lại lý thuyết trước khi thi tiếp.";
            else evaluationText = "ĐÁNH GIÁ CHUYÊN MÔN: Phát hiện lỗ hổng kiến thức nghiêm trọng. Các nền tảng lý thuyết cơ bản cần được giảng dạy lại. Khuyến nghị: Tạm dừng bài kiểm tra ngay lập tức để quay lại ôn tập sách giáo khoa.";
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <title>A90 Elite - Performance Report</title>
                <style>
                    @page { size: A4; margin: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 40px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .report-container { background: #ffffff; border-top: 16px solid #1e3a8a; padding: 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-radius: 12px; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 25px; margin-bottom: 30px; }
                    .brand-logo { color: #1e3a8a; font-size: 32px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
                    .brand-subtitle { font-size: 12px; color: #64748b; letter-spacing: 3px; text-transform: uppercase; }
                    .report-type h1 { margin: 0; font-size: 28px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; }
                    .candidate-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f8fafc; padding: 25px; border-radius: 8px; border-left: 6px solid #3b82f6; margin-bottom: 40px; }
                    .info-block { display: flex; flex-direction: column; }
                    .info-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; margin-bottom: 4px; }
                    .info-value { font-size: 18px; color: #0f172a; font-weight: 800; }
                    .stats-grid { display: flex; gap: 20px; margin-bottom: 40px; }
                    .stat-card { flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 25px 20px; text-align: center; }
                    .stat-card.primary { background: #1e3a8a; border: none; }
                    .stat-label { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 10px; }
                    .stat-card.primary .stat-label { color: #93c5fd; }
                    .stat-number { font-size: 38px; font-weight: 900; color: #0f172a; line-height: 1; }
                    .stat-card.primary .stat-number { color: #ffffff; }
                    .number-correct { color: #10b981; }
                    .number-incorrect { color: #ef4444; }
                    .evaluation-section h3 { font-size: 16px; color: #1e3a8a; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; }
                    .evaluation-box { background: #fff8f1; border-left: 5px solid #f59e0b; padding: 25px; font-size: 15px; color: #334155; line-height: 1.7; font-family: 'Georgia', serif; border-radius: 0 8px 8px 0; }
                    .footer { margin-top: 60px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; text-transform: uppercase; letter-spacing: 1px; }
                </style>
            </head>
            <body>
                <div class="report-container">
                    <div class="header">
                        <div><div class="brand-logo">A90 ELITE</div><div class="brand-subtitle">Academic Intelligence System</div></div>
                        <div class="report-type"><h1>BÁO CÁO KẾT QUẢ</h1></div>
                    </div>
                    <div class="candidate-info">
                        <div class="info-block"><span class="info-label">Định danh học viên</span><span class="info-value">${studentName}</span></div>
                        <div class="info-block"><span class="info-label">Chuyên đề đánh giá</span><span class="info-value">${topicTitle}</span></div>
                        <div class="info-block" style="grid-column: span 2;"><span class="info-label">Thời gian truy xuất dữ liệu</span><span class="info-value" style="font-size: 15px; color: #475569;">${dateStr}</span></div>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-card"><div class="stat-label">Tổng Câu Hỏi</div><div class="stat-number">${totalStr}</div></div>
                        <div class="stat-card"><div class="stat-label">Câu Đúng</div><div class="stat-number number-correct">${correctStr}</div></div>
                        <div class="stat-card"><div class="stat-label">Sai / Bỏ Qua</div><div class="stat-number number-incorrect">${incorrectStr}</div></div>
                        <div class="stat-card primary"><div class="stat-label">Tỷ Lệ Chính Xác</div><div class="stat-number">${accuracyStr}</div></div>
                    </div>
                    <div class="evaluation-section"><h3>Nhận xét & Phân tích Sư phạm</h3><div class="evaluation-box">${evaluationText}</div></div>
                    <div class="footer">Tài liệu lưu hành nội bộ — Được xuất tự động từ hệ thống A90 Elite</div>
                </div>
            </body>
            </html>`;

        const printWindow = window.open('', '_blank', 'width=900,height=950');
        if (!printWindow) { return alert('Vui lòng mở cấp quyền Popup để trích xuất bản in!'); }
        printWindow.document.open(); printWindow.document.write(htmlContent); printWindow.document.close();
        printWindow.onload = function() { printWindow.focus(); printWindow.print(); setTimeout(() => { printWindow.close(); }, 500); };
    }

    // -------------------------------------------------------------------------
    // 14. CENTRAL EVENT BINDINGS
    // -------------------------------------------------------------------------
    function bindCoreEvents() {
        $('start-random-btn')?.addEventListener('click', () => startQuiz('random'));
        $('start-full-btn')?.addEventListener('click', () => startQuiz('full'));
        $('start-smart-btn')?.addEventListener('click', () => startQuiz('full'));
        $('retry-wrong-btn')?.addEventListener('click', () => startQuiz('random'));

        document.querySelectorAll('.collapsed h3').forEach(header => {
            header.addEventListener('click', () => {
                const container = header.parentElement; container.classList.toggle('collapsed');
            });
        });

        $('change-name-btn')?.addEventListener('click', () => {
            const newName = prompt('Nhập tên mới của nhà vô địch:', state.currentUserName);
            if (newName && newName.trim() !== '') {
                const finalName = newName.trim(); state.currentUserName = finalName;
                localStorage.setItem(STORAGE_KEYS.LAST_USER_KEY, finalName);
                if (!state.allUsersData[finalName]) { state.allUsersData[finalName] = { score: 0, time: 0, logs: [], cups: 0 }; }
                if (dom.userSignature) dom.userSignature.textContent = finalName;
                alert(`Đã cập nhật danh tính thành: ${finalName}`);
            }
        });

        $('reset-db-btn')?.addEventListener('click', () => {
            if (confirm('CẢNH BÁO ELITE: Toàn bộ lịch sử, điểm số và Cúp của tất cả người dùng trên máy này sẽ bị xóa vĩnh viễn. Bạn có chắc chắn?')) {
                localStorage.removeItem(STORAGE_KEYS.ALL_USERS_DB_KEY); localStorage.removeItem(STORAGE_KEYS.LAST_USER_KEY);
                state.allUsersData = {}; state.currentUserName = ''; location.reload();
            }
        });

        $('export-btn')?.addEventListener('click', () => {
            if (Object.keys(state.allUsersData).length === 0) return alert('Hệ thống chưa có dữ liệu nào để sao lưu!');
            const blob = new Blob([JSON.stringify(state.allUsersData, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob); const a = document.createElement('a');
            a.href = url; a.download = `A90_Elite_Backup_${new Date().toISOString().slice(0,10)}.json`; a.click();
            URL.revokeObjectURL(url);
        });

        $('import-btn')?.addEventListener('click', () => { $('import-file')?.click(); });
        $('import-file')?.addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    state.allUsersData = { ...state.allUsersData, ...JSON.parse(event.target.result) };
                    localStorage.setItem(STORAGE_KEYS.ALL_USERS_DB_KEY, JSON.stringify(state.allUsersData));
                    alert('Khôi phục dữ liệu thành công!'); location.reload();
                } catch (err) { alert('Lỗi tệp khôi phục.'); }
            };
            reader.readAsText(file); e.target.value = '';
        });
        
        dom.subjectSelector?.addEventListener('change', () => {
            const v = dom.subjectSelector.value;
            if (!v || v.startsWith('comprehensive_')) { dom.topicSelector.innerHTML = '<option>---</option>'; dom.topicSelector.disabled = true; }
            else { dom.topicSelector.disabled = false; dom.topicSelector.innerHTML = '<option value="">--- Chọn Bài ---</option>'; state.allTopics.filter(t => t.subject === v).forEach(t => dom.topicSelector.innerHTML += `<option value="${t.originalIndex}">${t.name}</option>`); }
            if (dom.slogan) dom.slogan.textContent = `"${SLOGAN_LIBRARY[Math.floor(Math.random() * SLOGAN_LIBRARY.length)]}"`;
        });
        
        dom.nextQuestionBtn?.addEventListener('click', handleNextQuestion);
        dom.prevQuestionBtn?.addEventListener('click', handlePrevQuestion);

        // KÍCH HOẠT SỰ KIỆN IN ẤN CAO CẤP CHỐNG LỖI TRANG TRẮNG & VỠ GIAO DIỆN
        $('print-summary-report-btn')?.addEventListener('click', printSummaryReportCard);
        $('print-detail-report-btn')?.addEventListener('click', printEliteReportCard);
        $('print-detail-victory-btn')?.addEventListener('click', printEliteReportCard);

        dom.stopQuizBtn?.addEventListener('click', () => { $('stop-modal')?.classList.remove('hidden'); });
        $('stop-resume-btn')?.addEventListener('click', () => { $('stop-modal')?.classList.add('hidden'); });
        $('stop-new-btn')?.addEventListener('click', () => { $('stop-modal')?.classList.add('hidden'); if (state.currentMode) startQuiz(state.currentMode); });
        $('stop-home-btn')?.addEventListener('click', () => { $('stop-modal')?.classList.add('hidden'); resetQuizView(); });
        
        // Ép nút dừng bài gọi luồng in Premium cách ly thay vì window.print() nát bố cục
        $('stop-report-btn')?.addEventListener('click', () => { $('stop-modal')?.classList.add('hidden'); printEliteReportCard(); });

        $('review-btn')?.addEventListener('click', startReviewMode);
        $('go-home-btn')?.addEventListener('click', resetQuizView);

        document.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.repeat && document.activeElement !== dom.nameInput && !dom.quizScreen.classList.contains('hidden')) {
                const q = state.activeQuestions[state.currentQuestionIndex];
                if (q && q.isAnswered) handleNextQuestion();
                else { const btn = $('fill-in-submit') || $('multi-check-btn') || $('match-check-btn') || $('dropdown-check-btn') || $('category-check-btn') || $('order-check-btn'); if (btn && !btn.disabled) btn.click(); }
            }
        });

        const imgModal = $('image-modal'), modalContainer = $('modal-content-container');
        if (imgModal && modalContainer) {
            document.addEventListener('click', e => { if (e.target.closest('#image-render-area img, #image-render-area svg')) { modalContainer.innerHTML = (e.target.closest('img') || e.target.closest('svg')).outerHTML; imgModal.style.display = 'flex'; } });
            imgModal.onclick = () => imgModal.style.display = 'none';
        }
        window.addEventListener('resize', () => { if (typeof drawMatchingLines === 'function' && $('matching-svg-canvas') && state.activeQuestions[state.currentQuestionIndex]) drawMatchingLines(state.isReviewMode || state.activeQuestions[state.currentQuestionIndex].isAnswered); });
    }

    bindCoreEvents();

    dom.nameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const inputName = dom.nameInput.value.trim();
            if (!inputName) { alert('Vui lòng nhập một cái tên hợp lệ để bắt đầu!'); return; }
            state.currentUserName = inputName;
            localStorage.setItem(STORAGE_KEYS.LAST_USER_KEY, inputName);
            if (!state.allUsersData[inputName]) {
                state.allUsersData[inputName] = { score: 0, time: 0, logs: [], cups: 0 };
                localStorage.setItem(STORAGE_KEYS.ALL_USERS_DB_KEY, JSON.stringify(state.allUsersData));
            }
            if (dom.userSignature) dom.userSignature.textContent = inputName;
            dom.welcomePrompt?.classList.add('hidden'); dom.welcomeUser?.classList.remove('hidden');
            updateDashboard(); renderStatsAndLogs();
            alert(`🎯 Hệ thống A90 Elite xin chào nhà vô địch: ${inputName}!`);
        }
    });

    function renderStatsAndLogs() {
        const lbList = $('leaderboard-list');
        if (lbList) {
            const users = Object.keys(state.allUsersData).map(name => ({
                name, score: state.allUsersData[name].score || 0, cups: state.allUsersData[name].cups || 0
            })).sort((a, b) => b.score - a.score);
            if (users.length === 0) { lbList.innerHTML = '<li style="text-align:center;">Chưa có dữ liệu.</li>'; } 
            else { lbList.innerHTML = users.slice(0, 10).map((u, i) => `<li><span>${i + 1}. ${u.name}</span> <span style="color:var(--primary-color);">${u.score} điểm (🏆 ${u.cups})</span></li>`).join(''); }
        }

        const logList = $('user-log-list');
        if (logList && state.currentUserName && state.allUsersData[state.currentUserName]) {
            const logs = state.allUsersData[state.currentUserName].logs || [];
            if (logs.length === 0) { logList.innerHTML = '<li style="text-align:center;">Chưa có kết quả nào.</li>'; } 
            else { logList.innerHTML = [...logs].reverse().map(log => `<li class="log-item" style="display:flex; flex-direction:column; gap:5px;"><span><strong>${log.date}</strong> - ${log.topic}</span><span style="color:var(--correct-color);">Điểm: ${log.score} | Tỉ lệ đúng: ${log.acc}%</span></li>`).join(''); }
        }
    }

    async function initializeApp() {
        if ('speechSynthesis' in window) { loadEliteVoices(); }
        state.allUsersData = JSON.parse(localStorage.getItem(STORAGE_KEYS.ALL_USERS_DB_KEY) || '{}'); 
        const lUser = localStorage.getItem(STORAGE_KEYS.LAST_USER_KEY);
        await loadAndParseAllTopics(); 
        if (lUser && state.allUsersData[lUser]) { state.currentUserName = lUser; dom.welcomeUser?.classList.remove('hidden'); dom.welcomePrompt?.classList.add('hidden'); if (dom.userSignature) dom.userSignature.textContent = lUser; } 
        else { dom.welcomeUser?.classList.add('hidden'); dom.welcomePrompt?.classList.remove('hidden'); }
        dom.subjectSelector.innerHTML = '<option value="">--- Chọn Môn ---</option>'; 
        const subs = {}; state.allTopics.forEach(t => { if (!subs[t.subject]) subs[t.subject] = []; subs[t.subject].push(t); }); 
        Object.keys(subs).sort().forEach(s => dom.subjectSelector.innerHTML += `<option value="${s}">${s}</option>`); 
        const g = document.createElement('optgroup'); g.label = 'TỔNG HỢP'; Object.keys(subs).sort().forEach(s => g.innerHTML += `<option value="comprehensive_${s}">Tổng hợp ${s}</option>`); dom.subjectSelector.appendChild(g);
        renderStatsAndLogs();
    }

    initializeApp();
});
