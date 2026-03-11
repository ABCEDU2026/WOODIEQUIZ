/**
 * APP.JS - ELITE IVY LEAGUE MASTER FIX (v10.1 - PURE JSON & NATIVE SPEAKER ENGINE)
 * - Trạng thái: HOÀN HẢO TỐI THƯỢNG
 * - Xóa bỏ hoàn toàn Text Parsing. 
 * - Sử dụng luồng Fetch JSON chuẩn mực, siêu tốc độ (Parallel Fetching).
 * - Tích hợp Smart Voice Catcher v2.0: Tự động bắt giọng AI bản xứ.
 */

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================================================
    //  1. CONFIG & GLOBAL VARIABLES
    // ==========================================================================
    let currentUserName = "";
    let allUsersData = {}; 
    const ALL_USERS_DB_KEY = 'quizAppUsers_A80_Stable';
    const LAST_USER_KEY = 'quizAppLastUser_A80';
    const LAST_TOPIC_KEY = 'quizAppLastTopic_A80';

    // ĐÃ CHUYỂN TOÀN BỘ SANG ĐỊNH DẠNG .JSON
    const DATABASE_FILES = [
        'lichsudiali.json',
        'khoahoctunhien.json',
        'CIE6TW6.json',
        'toan6.json',
        'ENGLISHHK1.json',
        'questiontest.json',
        'IEL90.json',
        'nguvan6.json'
         'toanthaykien.json'
    ];

    // --- [A80 NATIVE SPEAKER ENGINE v2.0] GLOBAL VARS ---
    let eliteVoices = [];
    function loadEliteVoices() {
        if ('speechSynthesis' in window) {
            eliteVoices = window.speechSynthesis.getVoices();
        }
    }
    // Bắt buộc trình duyệt phải load giọng đọc ngay khi ứng dụng khởi động
    if ('speechSynthesis' in window && speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadEliteVoices;
    }
    // Chạy mồi một lần cho các trình duyệt không hỗ trợ onvoiceschanged
    loadEliteVoices();
    // ----------------------------------------------------

    // DOM Elements
    const appHeaderEl = document.getElementById('app-header');
    const startScreen = document.getElementById('start-screen');
    const quizScreen = document.getElementById('quiz-screen');
    const subjectSelector = document.getElementById('subject-selector'); 
    const topicSelector = document.getElementById('topic-selector');
    const topicTotalQuestionsEl = document.getElementById('topic-total-questions');
    const questionTextEl = document.getElementById('question-text');
    const optionsContainerEl = document.getElementById('options-container');
    const explanationBoxEl = document.getElementById('explanation-box');
    const explanationTextEl = document.getElementById('explanation-text');
    const readingPassageContainerEl = document.getElementById('reading-passage-container');
    const navigationControls = document.getElementById('navigation-controls');
    const nextQuestionBtn = document.getElementById('next-question-btn');
    const prevQuestionBtn = document.getElementById('prev-question-btn');
    const stopQuizBtn = document.getElementById('stop-quiz-btn'); 
    const askAiBtn = document.getElementById('ask-ai-btn');
    const aiResponseArea = document.getElementById('ai-response-area');
    const aiContentText = document.getElementById('ai-content-text');

    let submitQuizBtn = document.getElementById('submit-quiz-btn');
    if (!submitQuizBtn && navigationControls) {
        submitQuizBtn = document.createElement('button');
        submitQuizBtn.id = 'submit-quiz-btn';
        submitQuizBtn.textContent = 'NỘP BÀI';
        submitQuizBtn.className = 'nav-btn primary';
        submitQuizBtn.style.display = 'none'; 
        submitQuizBtn.style.backgroundColor = '#f59e0b';
        submitQuizBtn.style.color = 'white';
        navigationControls.insertBefore(submitQuizBtn, stopQuizBtn);
    }
    
    const dashboardHeaderEl = document.getElementById('dashboard-header');
    const questionCounterEl = document.getElementById('question-counter');
    const questionNavGridEl = document.getElementById('question-nav-grid');
    const resultsModal = document.getElementById('results-modal');
    const victoryModal = document.getElementById('victory-modal');
    const nameInputEl = document.getElementById('name-input');
    const sloganEl = document.getElementById('daily-slogan');

    const sounds = { 
        correct: document.getElementById('sound-correct'), 
        incorrect: document.getElementById('sound-incorrect'), 
        start: document.getElementById('sound-start'), 
        victory: document.getElementById('sound-victory') 
    };

    let allTopics = [];                 
    let activeQuestions = [];           
    let currentQuestionIndex = 0;       
    let correctAnswers = 0;             
    let incorrectAnswers = 0;           
    let lifetimeCorrect = 0;            
    let quizTimer;                      
    let autoAdvanceTimeout;             
    let currentMode = '';               
    let isReviewMode = false;           
    let seenQuestionIds = {};           
    const AUTO_ADVANCE_DELAY = 1500;    
    let currentQuizTitle = '';          
    let quizStartTime;

    const LEVELS = [
        { score: 0, name: "Tân binh 🔰" },
        { score: 50, name: "Học trò 🧑‍🎓" },
        { score: 150, name: "Học giả 📚" },
        { score: 300, name: "Thông thái 🧠" },
        { score: 500, name: "Giáo sư 🧑‍🏫" },
        { score: 1000, name: "Hiền triết 🏛️" }
    ];
    
    let matchingState = { selectedLeft: null, userMatches: {} };
    let categorizationState = { draggingTag: null };

    // ==========================================================================
    //  2. UTILITIES & PURE JSON LOADER
    // ==========================================================================

    function shuffleArray(array) {
        let newArr = [...array];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    }

    function normalizeString(str) { return str ? str.toString().trim().toLowerCase().replace(/\s+/g, ' ') : ""; }

    function fixMalformedSVG(htmlString) {
        if (!htmlString || typeof htmlString !== 'string') return "";
        if (!htmlString.includes('<svg')) return htmlString;
        return htmlString.replace(/viewBox=([\d\s\.-]+)/g, 'viewBox="$1"')
            .replace(/points=([\d,\s\.-]+)/g, 'points="$1"')
            .replace(/width=(\d+)/g, 'width="$1"')
            .replace(/height=(\d+)/g, 'height="$1"')
            .replace(/xmlns=([^\s>]+)/g, 'xmlns="$1"')
            .replace(/style=([^"'>]+)/g, 'style="$1"');
    }

    const SLOGAN_LIBRARY = [
        "🚀 Kiến thức là sức mạnh - Level up your brain!",
        "🌱 Mỗi ngày học một chút, tương lai sáng ngời.",
        "🔥 Sai thì sửa, đừng ngại thử thách!",
        "🧠 Nâng cấp bộ não, bão tố cũng qua!"
    ];
    function randomizeSlogan() { if(sloganEl) sloganEl.textContent = `"${SLOGAN_LIBRARY[Math.floor(Math.random() * SLOGAN_LIBRARY.length)]}"`; }

    function calculateLevel(score) {
        let currentLevel = LEVELS[0].name; 
        for (let i = LEVELS.length - 1; i >= 0; i--) { if (score >= LEVELS[i].score) { currentLevel = LEVELS[i].name; break; } }
        return currentLevel;
    }

    // --- [A80 TỐI THƯỢNG] THUẬT TOÁN FETCH PURE JSON (PARALLEL LOADING) ---
    async function loadAndParseAllTopics() {
        allTopics = [];
        
        const fetchPromises = DATABASE_FILES.map(file => 
            fetch(file)
                .then(res => {
                    if (!res.ok) throw new Error(`Không thể truy cập: ${file}`);
                    return res.json();
                })
                .catch(err => {
                    console.error(`🔴 A80 Error Boundary: ${err.message}`);
                    return null; 
                })
        );

        const results = await Promise.all(fetchPromises);

        results.filter(data => data !== null).forEach((jsonData) => {
            jsonData.forEach((topicObj) => {
                const questions = topicObj.questions.map((q, index) => ({
                    ...q,
                    id: q.id || `${topicObj.topic.replace(/\s/g, '_')}-${index}`,
                    userAnswer: null,
                    isAnswered: false,
                    leftCol: q.leftCol || [],
                    rightCol: q.rightCol || []
                }));

                allTopics.push({
                    name: topicObj.topic || "Untitled",
                    subject: topicObj.subject || "General",
                    questions: questions,
                    originalIndex: allTopics.length
                });
            });
        });

        console.log("✅ A80 Core: Hệ thống đã sẵn sàng với dữ liệu an toàn.", allTopics);
    }

    // ==========================================================================
    //  3. CORE QUIZ LOGIC
    // ==========================================================================

    function startQuiz(mode) {
        if (currentUserName === "") { alert("Vui lòng nhập tên của bạn trước khi bắt đầu!"); nameInputEl.focus(); return; }
        
        localStorage.setItem(LAST_TOPIC_KEY, topicSelector.value); 
        currentMode = mode;
        isReviewMode = false;
        
        if(dashboardHeaderEl) dashboardHeaderEl.textContent = currentUserName;
        appHeaderEl.classList.remove('hidden');
        document.body.classList.add('quiz-active');

        const subjectValue = subjectSelector.value;
        const topicValue = topicSelector.value;
        let questionBank; 

        if (!subjectValue) { alert("Vui lòng chọn một môn học!"); return; }

        if (subjectValue.startsWith('comprehensive_')) {
            const subjectToTest = subjectValue.replace('comprehensive_', '');
            currentQuizTitle = `TỔNG HỢP: ${subjectToTest}`;
            questionBank = allTopics.filter(topic => topic.subject === subjectToTest).reduce((acc, topic) => acc.concat(topic.questions), []);
            questionBank = questionBank.map((q, i) => ({...q, id: `${subjectToTest}-all-${i}`}));
        } else { 
            const selectedIndex = parseInt(topicValue, 10);
            if (isNaN(selectedIndex) || !allTopics[selectedIndex]) { alert("Vui lòng chọn một chủ đề / bài học!"); return; }
            const selectedTopic = allTopics[selectedIndex];
            currentQuizTitle = `${selectedTopic.subject.toUpperCase()} - ${selectedTopic.name}`;
            questionBank = JSON.parse(JSON.stringify(selectedTopic.questions));
        }

        appHeaderEl.textContent = `<<BÀI TRẮC NGHIỆM>> ${currentQuizTitle}`;

        let questionPool;
        if (mode === 'random') {
            const topicNameForSeen = subjectValue.startsWith('comprehensive_') ? subjectValue : (allTopics[topicValue] ? allTopics[topicValue].name : 'unknown_topic');
            const seenIdsForTopic = seenQuestionIds[topicNameForSeen] || [];
            let unseenQuestions = questionBank.filter(q => !seenIdsForTopic.includes(q.id));
            if (unseenQuestions.length < 10) { seenQuestionIds[topicNameForSeen] = []; unseenQuestions = questionBank; }
            questionPool = shuffleArray(unseenQuestions).slice(0, 20);
        } else {
            questionPool = questionBank;
        }

        activeQuestions = questionPool.map(q => prepareQuestionData(q));
        if (activeQuestions.length === 0) { alert("Không có câu hỏi nào để hiển thị."); return; }

        currentQuestionIndex = 0;
        correctAnswers = 0;
        incorrectAnswers = 0;
        
        startScreen.classList.add('hidden');
        quizScreen.classList.remove('hidden');
        updateUserCupDisplay(); 
        
        createQuestionNav();
        startTimer(); 
            if(sounds.start) {
            sounds.start.volume = 0.5;
            sounds.start.play().catch(e => console.log("Chặn tiếng"));
        }
        displayQuestion();
        updateDashboard();

        if(submitQuizBtn) {
            submitQuizBtn.style.display = 'inline-block';
            submitQuizBtn.onclick = function() {
                if(confirm("Bạn có chắc muốn NỘP BÀI và kết thúc ngay không?")) endQuiz();
            };
        }
    }

    function prepareQuestionData(question) {
        const q = JSON.parse(JSON.stringify(question));
        // Đảo đáp án cho Multiple Choice VÀ Listening
        if (q.type === 'mot_dap_an' || q.type === 'listening') {
            const keys = Object.keys(q.options);
            const shuffledKeys = shuffleArray([...keys]);
            const originalCorrectContent = q.options[q.answer];
            const shuffledContentMap = {};
            ['a', 'b', 'c', 'd'].forEach((newKey, index) => {
                if (shuffledKeys[index]) {
                    shuffledContentMap[newKey] = q.options[shuffledKeys[index]];
                }
            });
            q.options = shuffledContentMap;
            for (const [key, val] of Object.entries(q.options)) {
                if (val === originalCorrectContent) { q.answer = key; break; }
            }
        }
        if (q.type === 'nhieu_dap_an') {
             const keys = Object.keys(q.options);
             const shuffledKeys = shuffleArray([...keys]); 
             const newOptions = {};
             const fixedKeys = ['a', 'b', 'c', 'd'].slice(0, keys.length);
             const correctContents = q.answer.map(k => q.options[k]);
             const newAnswerKeys = [];
             fixedKeys.forEach((fixedKey, idx) => {
                 const originalKey = shuffledKeys[idx];
                 const content = q.options[originalKey];
                 newOptions[fixedKey] = content;
                 if (correctContents.includes(content)) {
                     newAnswerKeys.push(fixedKey);
                 }
             });
             q.options = newOptions;
             q.answer = newAnswerKeys;
        }
        if (q.type === 'noi') {
            const rightObjects = q.rightCol.map((txt, idx) => ({ text: txt, originalIndex: idx }));
            q.shuffledRightCol = shuffleArray(rightObjects);
        }
        return q;
    }

    function displayQuestion() {
        clearTimeout(autoAdvanceTimeout); 
        
        // Ngắt âm thanh AI khi chuyển câu để không bị đè giọng
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        
        updateQuestionNav();
        
        if(aiResponseArea) aiResponseArea.classList.add('hidden');
        if(aiContentText) aiContentText.innerHTML = '';
        
        matchingState.selectedLeft = null; 
        matchingState.userMatches = {}; 
        
        const question = activeQuestions[currentQuestionIndex];
        if (question.type === 'noi' && question.userAnswer) {
             matchingState.userMatches = {...question.userAnswer};
        }
        
        categorizationState.draggingTag = null;
        const qType = (question.type || 'mot_dap_an').toLowerCase(); 
        questionCounterEl.textContent = `Câu ${currentQuestionIndex + 1} / ${activeQuestions.length}`;
        
        if (qType === 'dropdown') { 
            questionTextEl.style.display = 'none'; 
            questionTextEl.innerHTML = ''; 
        } else { 
            questionTextEl.style.display = 'block'; 
            questionTextEl.innerHTML = fixMalformedSVG(question.question); 
        }

        optionsContainerEl.innerHTML = ''; 
        
        if (readingPassageContainerEl) {
             if (question.doan_van && question.doan_van.trim() !== '') { 
                 const formattedPassage = question.doan_van.trim().split('\n').filter(l => l.trim() !== '').map(l => `<p>${l.trim()}</p>`).join('');
                 readingPassageContainerEl.innerHTML = `<div class="reading-passage-header">📖 ĐỌC HIỂU NGUỒN</div><div class="reading-content">${formattedPassage}</div>`; 
                 readingPassageContainerEl.classList.remove('hidden'); 
             } else { 
                 readingPassageContainerEl.classList.add('hidden'); 
             }
        }
        
        switch (qType) {
            case 'listening': renderListening(question); break;
            case 'dien_khuyet': renderFillInTheBlank(question); break;
            case 'noi': renderMatching(question); break;
            case 'nhieu_dap_an': renderMultiResponse(question); break;
            case 'dropdown': renderDropdown(question); break;
            case 'sap_xep': renderOrdering(question); break;
            case 'phan_loai': renderCategorization(question); break;
            case 'dung_sai': renderTrueFalse(question); break;
            default: renderMultipleChoice(question); break;
        }

        if (question.isAnswered || isReviewMode) showAnswerState(question);
        else explanationBoxEl.classList.add('hidden');

        updateQuestionNav();
        if (window.MathJax) MathJax.typesetPromise([questionTextEl, optionsContainerEl, explanationBoxEl]);
    }

    // ==========================================================================
    //  4. RENDERERS (FULL)
    // ==========================================================================

    function renderMultipleChoice(question) {
        Object.keys(question.options).sort().forEach(key => {
            const button = document.createElement('button'); 
            button.className = 'option'; 
            button.dataset.answer = key; 
            button.innerHTML = `<strong>${key.toUpperCase()}.</strong> ${question.options[key]}`;
            if (question.isAnswered || isReviewMode) button.disabled = true;
            else button.addEventListener('click', () => selectAnswer(key));
            optionsContainerEl.appendChild(button);
        });
    }

    function renderListening(question) {
        optionsContainerEl.innerHTML = `
            <div class="listening-container" style="text-align: center; margin-bottom: 25px; padding: 25px; background: #f8fafc; border-radius: 16px; border: 2px dashed #6366f1;">
                <button id="play-audio-btn" class="nav-btn" style="background: linear-gradient(45deg, #f59e0b, #d97706); width: auto; padding: 15px 40px; font-size: 1.1rem; border-radius: 50px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);">
                    🎧 NGHE BÀI GIẢNG (IVY VOICE)
                </button>
                <p style="font-size: 0.95rem; color: #6b7280; margin-top: 12px; font-weight: 700;">Click để nghe đoạn hội thoại học thuật</p>
            </div>
            <div id="listening-options-wrapper" style="width: 100%;"></div>
        `;

        const playBtn = document.getElementById('play-audio-btn');
        playBtn.onclick = () => {
            if (!question.audio_text) {
                alert("Lỗi Dữ Liệu: Không tìm thấy nội dung bài nghe.");
                return;
            }
            playNativeAudio(question.audio_text);
        };

        const optionsWrapper = document.getElementById('listening-options-wrapper');
        Object.keys(question.options).sort().forEach(key => {
            const button = document.createElement('button'); 
            button.className = 'option'; 
            button.dataset.answer = key; 
            button.innerHTML = `<strong>${key.toUpperCase()}.</strong> ${question.options[key]}`;
            if (question.isAnswered || isReviewMode) button.disabled = true;
            else button.addEventListener('click', () => selectAnswer(key));
            optionsWrapper.appendChild(button);
        });
    }

    // --- [A80 TỐI THƯỢNG] THUẬT TOÁN SMART VOICE CATCHER v2.0 ---
    function playNativeAudio(text) {
        if (!('speechSynthesis' in window)) {
            alert("Trình duyệt của bạn không hỗ trợ tính năng đọc AI. Hãy thử dùng Chrome, Edge hoặc Safari bản mới nhất.");
            return;
        }
        if (!text) return;

        // 1. Dập tắt các luồng âm thanh cũ đang bị kẹt (Chống nhiễu giọng)
        window.speechSynthesis.cancel();

        // 2. Khởi tạo luồng phát mới
        const utterance = new SpeechSynthesisUtterance(text);
        
        // 3. Tinh chỉnh thông số (Rate 0.9 giúp phát âm rõ âm cuối như người thật)
        utterance.lang = 'en-US';
        utterance.rate = 0.9;  
        utterance.pitch = 1.0; 
        utterance.volume = 1.0;

        // Đảm bảo mảng giọng đọc đã sẵn sàng
        if (eliteVoices.length === 0) {
            loadEliteVoices();
        }

        // 4. THUẬT TOÁN ĐỊNH VỊ GIỌNG ĐỌC PREMIUM (VOICE HUNTER)
        // Lọc qua hàng trăm giọng của máy tính/điện thoại để tìm ra các "Viên ngọc quý"
        const bestVoice = 
            eliteVoices.find(v => v.name.includes('Natural') && v.lang.includes('en')) || // (Top 1) Microsoft Edge Natural Voices (AI Cloud - Rất mượt)
            eliteVoices.find(v => v.name.includes('Google US English')) ||                // (Top 2) Trình duyệt Chrome Cloud Voice
            eliteVoices.find(v => v.name.includes('Samantha') && v.lang === 'en-US') ||   // (Top 3) Giọng nữ cao cấp của Apple MacOS/iOS
            eliteVoices.find(v => v.name.includes('Daniel') && v.lang === 'en-GB') ||     // (Top 4) Giọng nam chuẩn Anh Quốc của Apple
            eliteVoices.find(v => v.lang === 'en-US' || v.lang === 'en-GB');              // (Fallback) Nếu máy quá cũ, lấy tạm giọng tiếng Anh bất kỳ

        // 5. Gắn giọng và Phát
        if (bestVoice) {
            utterance.voice = bestVoice;
            console.log(`[A80 Audio Engine] Đã kích hoạt giọng bản xứ: ${bestVoice.name}`);
        } else {
            console.log(`[A80 Audio Engine] Đang sử dụng giọng mặc định của hệ thống.`);
        }

        window.speechSynthesis.speak(utterance);
    }
    // -----------------------------------------------------------

    function renderMultiResponse(question) {
        optionsContainerEl.innerHTML = '<p style="font-size: 0.9rem; color: var(--grey-text); margin-bottom: 10px;">(Chọn tất cả các đáp án đúng)</p>';
        const checkBtn = document.createElement('button'); checkBtn.id = 'multi-check-btn'; checkBtn.className = 'nav-btn'; checkBtn.textContent = 'Kiểm tra đáp án';
        Object.keys(question.options).sort().forEach(key => {
            const button = document.createElement('button'); button.className = 'option'; button.dataset.answer = key; button.innerHTML = `<strong>${key.toUpperCase()}.</strong> ${question.options[key]}`;
            if (question.isAnswered || isReviewMode) { button.disabled = true; if (question.userAnswer && question.userAnswer.includes(key)) button.classList.add('selected'); } 
            else { button.addEventListener('click', () => { button.classList.toggle('selected'); checkBtn.disabled = optionsContainerEl.querySelectorAll('.option.selected').length === 0; }); }
            optionsContainerEl.appendChild(button);
        });
        if (!question.isAnswered && !isReviewMode) { checkBtn.disabled = true; checkBtn.addEventListener('click', checkMultiResponseAnswer); optionsContainerEl.appendChild(checkBtn); }
    }

    function renderMatching(question) {
        const leftCol = question.leftCol;
        const displayRightCol = question.shuffledRightCol || question.rightCol.map((t,i)=>({text:t, originalIndex:i}));
        let leftHtml = '', rightHtml = '';
        leftCol.forEach((item, index) => { leftHtml += `<div class="match-item match-left" data-match-id="left-${index}">${item}</div>`; });
        displayRightCol.forEach((item) => { rightHtml += `<div class="match-item match-right" data-match-id="right-${item.originalIndex}">${item.text}</div>`; });
        optionsContainerEl.innerHTML = `
            <div id="matching-container">
                <svg id="matching-svg-canvas"></svg>
                <div id="matching-col-left">${leftHtml}</div>
                <div id="matching-col-right">${rightHtml}</div>
            </div>
            <button id="match-check-btn" class="nav-btn">Kiểm tra đáp án</button>`;
        const checkBtn = document.getElementById('match-check-btn');
        drawMatchingLines(question.isAnswered || isReviewMode);
        if (!question.isAnswered && !isReviewMode) {
            checkBtn.disabled = Object.keys(matchingState.userMatches).length === 0;
            document.querySelectorAll('.match-item').forEach(item => { item.addEventListener('click', handleMatchClick); });
            checkBtn.addEventListener('click', checkMatchingAnswer);
        } else {
             checkBtn.style.display = 'none';
             document.querySelectorAll('.match-item').forEach(i => i.style.pointerEvents = 'none');
        }
        window.removeEventListener('resize', handleResizeMatching);
        window.addEventListener('resize', handleResizeMatching);
    }
    
    function handleMatchClick(e) {
        const clickedItem = e.target;
        const id = clickedItem.dataset.matchId;
        if (clickedItem.classList.contains('matched')) {
            let leftKeyToRemove = null;
            if (id.startsWith('left-')) leftKeyToRemove = id;
            else for (const [key, value] of Object.entries(matchingState.userMatches)) if (value === id) { leftKeyToRemove = key; break; }
            if (leftKeyToRemove) {
                delete matchingState.userMatches[leftKeyToRemove];
                updateMatchingClasses();
                drawMatchingLines(false);
                const checkBtn = document.getElementById('match-check-btn');
                if (checkBtn) checkBtn.disabled = Object.keys(matchingState.userMatches).length === 0;
            }
            return;
        }
        if (id.startsWith('left-')) {
            if (matchingState.selectedLeft === clickedItem) { matchingState.selectedLeft.classList.remove('selected'); matchingState.selectedLeft = null; } 
            else { if (matchingState.selectedLeft) matchingState.selectedLeft.classList.remove('selected'); matchingState.selectedLeft = clickedItem; clickedItem.classList.add('selected'); }
        } else if (id.startsWith('right-') && matchingState.selectedLeft) {
            const isRightTaken = Object.values(matchingState.userMatches).includes(id);
            if (isRightTaken) return; 
            const leftId = matchingState.selectedLeft.dataset.matchId;
            matchingState.userMatches[leftId] = id;
            updateMatchingClasses();
            matchingState.selectedLeft.classList.remove('selected');
            matchingState.selectedLeft = null;
            drawMatchingLines(false);
            const checkBtn = document.getElementById('match-check-btn');
            if (checkBtn) checkBtn.disabled = false;
        }
    }
    
    function updateMatchingClasses() {
        document.querySelectorAll('.match-item').forEach(el => el.classList.remove('matched'));
        for (const leftId in matchingState.userMatches) {
            const rightId = matchingState.userMatches[leftId];
            const l = document.querySelector(`[data-match-id="${leftId}"]`);
            const r = document.querySelector(`[data-match-id="${rightId}"]`);
            if(l) l.classList.add('matched');
            if(r) r.classList.add('matched');
        }
    }

    function drawMatchingLines(isReview) {
        const svg = document.getElementById('matching-svg-canvas');
        if (!svg) return; svg.innerHTML = ''; 
        const container = document.getElementById('matching-container'); 
        const containerRect = container.getBoundingClientRect();
        for (const leftId in matchingState.userMatches) {
            const rightId = matchingState.userMatches[leftId];
            drawLine(svg, leftId, rightId, containerRect, isReview);
        }
        if (isReview && activeQuestions[currentQuestionIndex]) {
            activeQuestions[currentQuestionIndex].leftCol.forEach((_, idx) => {
                const correctLeftId = `left-${idx}`;
                const correctRightId = `right-${idx}`;
                if (matchingState.userMatches[correctLeftId] !== correctRightId) drawLine(svg, correctLeftId, correctRightId, containerRect, false, true);
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
    
    function handleResizeMatching() { if(activeQuestions[currentQuestionIndex] && activeQuestions[currentQuestionIndex].type === 'noi') drawMatchingLines(isReviewMode || activeQuestions[currentQuestionIndex].isAnswered); }

    function renderDropdown(question) {
        question.correctDropdowns = []; 
        const processedHTML = question.question.replace(/\[\[(.*?)\]\]/g, (match, content) => {
            const options = content.split('|'); 
            question.correctDropdowns.push(options[0]); 
            const shuffledOptions = shuffleArray(options);
            let selectHTML = `<select class="dropdown-select"><option value="">...</option>`;
            
            shuffledOptions.forEach(opt => { 
                const safeOpt = opt.replace(/"/g, '&quot;');
                selectHTML += `<option value="${safeOpt}">${opt}</option>`; 
            });
            
            return selectHTML + `</select>`;
        });
        optionsContainerEl.innerHTML = `<div class="dropdown-question-text">${processedHTML}</div>`;
        if (!question.isAnswered && !isReviewMode) {
            const checkBtn = document.createElement('button'); 
            checkBtn.id = 'dropdown-check-btn'; checkBtn.className = 'nav-btn'; checkBtn.textContent = 'Kiểm tra đáp án'; 
            checkBtn.disabled = true;
            optionsContainerEl.appendChild(checkBtn);
            const allSelects = optionsContainerEl.querySelectorAll('.dropdown-select');
            allSelects.forEach(select => { select.addEventListener('change', () => { checkBtn.disabled = Array.from(allSelects).every(s => s.value === ""); }); });
            checkBtn.addEventListener('click', checkDropdownAnswer);
        } else if (question.userAnswer) {
            optionsContainerEl.querySelectorAll('.dropdown-select').forEach((select, index) => { select.value = question.userAnswer[index] || ""; select.disabled = true; });
        }
    }

    function renderFillInTheBlank(question) {
        const previousAnswer = (question.userAnswer !== null) ? question.userAnswer : "";
        const safePrevAnswer = previousAnswer.toString().replace(/"/g, '&quot;');
        
        optionsContainerEl.innerHTML = `<div style="display: flex; gap: 10px;"><input type="text" id="fill-in-input" class="option" placeholder="Nhập câu trả lời..." value="${safePrevAnswer}" autocomplete="off"><button id="fill-in-submit" class="nav-btn">Kiểm tra</button></div>`;
        const inputEl = document.getElementById('fill-in-input');
        const submitBtn = document.getElementById('fill-in-submit');
        if (!question.isAnswered && !isReviewMode) {
            submitBtn.disabled = true;
            inputEl.addEventListener('input', () => submitBtn.disabled = inputEl.value.trim() === "");
            submitBtn.addEventListener('click', () => selectAnswer(inputEl.value));
            inputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !submitBtn.disabled) selectAnswer(inputEl.value); });
            setTimeout(() => inputEl.focus(), 100);
        } else { inputEl.disabled = true; submitBtn.style.display = 'none'; }
    }

    function renderCategorization(question) {
        let groupsHTML = ''; 
        question.nhom.forEach((nhomText, index) => { groupsHTML += `<div class="category-group-box" data-group-index="${index}"><h4>${nhomText}</h4></div>`; });
       
        let tagsHTML = ''; 
        shuffleArray(question.the).forEach((tagText) => { 
            const safeTagText = tagText.replace(/"/g, '&quot;');
            tagsHTML += `<div class="category-tag" draggable="true" data-tag-text="${safeTagText}">${tagText}</div>`; 
        });

        optionsContainerEl.innerHTML = `<div class="categorization-container"><div class="category-groups">${groupsHTML}</div><p style="text-align: center; color: var(--grey-text);">🔻 Kéo các thẻ vào nhóm tương ứng 🔻</p><div class="category-tags-pool">${tagsHTML}</div></div><button id="category-check-btn" class="nav-btn">Kiểm tra đáp án</button>`;
        const checkBtn = document.getElementById('category-check-btn');
        if (!question.isAnswered && !isReviewMode) {
            checkBtn.disabled = true;
            setupDragAndDrop(checkBtn);
            checkBtn.addEventListener('click', checkCategorizationAnswer);
        }
        if (isReviewMode && question.userAnswer) {
             checkBtn.style.display = 'none'; 
             const tagsPool = optionsContainerEl.querySelector('.category-tags-pool'); tagsPool.innerHTML = ''; 
             Object.entries(question.userAnswer).forEach(([tagText, groupIndex]) => {
                 const tag = document.createElement('div'); tag.className = 'category-tag'; tag.dataset.tagText = tagText.replace(/"/g, '&quot;'); tag.textContent = tagText;
                 if (groupIndex === -1) tagsPool.appendChild(tag); 
                 else { 
                     const groupZone = optionsContainerEl.querySelector(`.category-group-box[data-group-index="${groupIndex}"]`); 
                     if(groupZone) groupZone.appendChild(tag); 
                 }
             });
        }
    }

    function setupDragAndDrop(checkBtn) {
        const tags = document.querySelectorAll('.category-tag');
        const poolZone = document.querySelector('.category-tags-pool');
        tags.forEach(tag => {
            tag.addEventListener('dragstart', () => { categorizationState.draggingTag = tag; tag.classList.add('dragging'); });
            tag.addEventListener('dragend', () => { tag.classList.remove('dragging'); categorizationState.draggingTag = null; if(poolZone.children.length < tags.length) checkBtn.disabled = false; });
            tag.addEventListener('touchstart', (e) => { categorizationState.draggingTag = tag; tag.classList.add('dragging'); }, {passive: false});
            tag.addEventListener('touchend', (e) => { 
                tag.classList.remove('dragging'); 
                const touch = e.changedTouches[0]; 
                const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                if(elementBelow) { 
                    const dropZone = elementBelow.closest('.category-group-box, .category-tags-pool'); 
                    if (dropZone) { dropZone.appendChild(tag); if(poolZone.children.length < tags.length) checkBtn.disabled = false; } 
                }
            });
            tag.addEventListener('touchmove', (e) => { e.preventDefault(); }, {passive: false});
        });
        document.querySelectorAll('.category-group-box, .category-tags-pool').forEach(zone => {
            zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
            zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
            zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag-over'); if (categorizationState.draggingTag) zone.appendChild(categorizationState.draggingTag); });
        });
    }

    function renderTrueFalse(question) {
        optionsContainerEl.innerHTML = `<div class="tf-button-container"><button class="option tf-btn" data-answer="dung">ĐÚNG</button><button class="option tf-btn" data-answer="sai">SAI</button></div>`;
        if (!question.isAnswered && !isReviewMode) { optionsContainerEl.querySelectorAll('.tf-btn').forEach(btn => btn.addEventListener('click', () => selectAnswer(btn.dataset.answer))); }
    }

    function renderOrdering(question) {
        const itemsToShow = (question.isAnswered || isReviewMode) ? (question.userAnswer || []) : shuffleArray(question.muc);

        let itemsHTML = ''; 
        itemsToShow.forEach((itemText) => { 
            const safeItemText = itemText.replace(/"/g, '&quot;');
            itemsHTML += `<li class="ordering-item" draggable="true" data-text="${safeItemText}">${itemText}</li>`; 
        });

        optionsContainerEl.innerHTML = `<div style="font-style: italic; color: var(--grey-text); margin-bottom: 10px; text-align: center;">(Kéo thả để sắp xếp)</div><ul id="ordering-list" class="ordering-container">${itemsHTML}</ul><button id="order-check-btn" class="nav-btn">Kiểm tra đáp án</button>`;
        const checkBtn = document.getElementById('order-check-btn');
        if (!question.isAnswered && !isReviewMode) {
            checkBtn.disabled = true;
            setupOrderingDrag(checkBtn);
            checkBtn.addEventListener('click', checkOrderingAnswer);
        } else { checkBtn.style.display = 'none'; }
    }

    function setupOrderingDrag(checkBtn) {
        const list = document.getElementById('ordering-list'); 
        let draggingItem = null;
        list.querySelectorAll('.ordering-item').forEach(item => {
            item.addEventListener('dragstart', () => { draggingItem = item; setTimeout(() => item.classList.add('dragging'), 0); });
            item.addEventListener('dragend', () => { item.classList.remove('dragging'); draggingItem = null; checkBtn.disabled = false; });
            item.addEventListener('dragover', (e) => { e.preventDefault(); const afterElement = getDragAfterElement(list, e.clientY); if (afterElement == null) list.appendChild(draggingItem); else list.insertBefore(draggingItem, afterElement); });
        });
    }
    
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.ordering-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset: offset, element: child }; else return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // ==========================================================================
    //  5. CHECKING LOGIC
    // ==========================================================================

    function selectAnswer(userSelection) { 
        const question = activeQuestions[currentQuestionIndex];
        if (question.isAnswered) return;
        question.isAnswered = true;
        question.userAnswer = userSelection; 
        let isCorrect = (question.type === 'dien_khuyet') ? normalizeString(userSelection) === normalizeString(question.answer) : (userSelection === question.answer);
        finalizeAnswer(isCorrect, question);
    }

    function checkMultiResponseAnswer() {
        const question = activeQuestions[currentQuestionIndex];
        const selected = Array.from(optionsContainerEl.querySelectorAll('.option.selected')).map(b => b.dataset.answer);
        question.isAnswered = true;
        const isCorrect = JSON.stringify(selected.sort()) === JSON.stringify(question.answer.sort());
        question.userAnswer = selected;
        finalizeAnswer(isCorrect, question);
    }

    function checkMatchingAnswer() {
        const question = activeQuestions[currentQuestionIndex];
        const userMatches = matchingState.userMatches;
        let correctCount = 0;
        for (const [leftId, rightId] of Object.entries(userMatches)) {
            const leftIndex = leftId.split('-')[1];
            const rightIndex = rightId.split('-')[1];
            if (leftIndex === rightIndex) correctCount++;
        }
        const isCorrect = (correctCount === question.leftCol.length) && (Object.keys(userMatches).length === question.leftCol.length);
        question.isAnswered = true;
        question.userAnswer = {...userMatches};
        finalizeAnswer(isCorrect, question);
    }

    function checkDropdownAnswer() {
        const question = activeQuestions[currentQuestionIndex];
        const selects = optionsContainerEl.querySelectorAll('.dropdown-select');
        const userAnswers = Array.from(selects).map(s => s.value);
        let isCorrect = true;
        userAnswers.forEach((ans, idx) => { if (ans !== question.correctDropdowns[idx]) isCorrect = false; });
        question.isAnswered = true;
        question.userAnswer = userAnswers;
        selects.forEach((s, idx) => { s.disabled = true; if (s.value === question.correctDropdowns[idx]) s.classList.add('correct'); else s.classList.add('incorrect'); });
        finalizeAnswer(isCorrect, question);
    }

    function checkCategorizationAnswer() {
        const question = activeQuestions[currentQuestionIndex];
        const groupBoxes = optionsContainerEl.querySelectorAll('.category-group-box');
        const userMap = {}; 
        let isCorrect = true;
        groupBoxes.forEach(box => {
            const groupIndex = parseInt(box.dataset.groupIndex);
            const tags = box.querySelectorAll('.category-tag');
            tags.forEach(tag => {
                userMap[tag.dataset.tagText] = groupIndex;
                const correctGroupIndex = question.dap_an[tag.dataset.tagText];
                if (groupIndex === correctGroupIndex) tag.classList.add('correct'); else { tag.classList.add('incorrect'); isCorrect = false; }
            });
        });
        if (optionsContainerEl.querySelectorAll('.category-tags-pool .category-tag').length > 0) isCorrect = false;
        question.isAnswered = true;
        question.userAnswer = userMap;
        finalizeAnswer(isCorrect, question);
    }

    function checkOrderingAnswer() {
        const question = activeQuestions[currentQuestionIndex];
        const items = optionsContainerEl.querySelectorAll('.ordering-item');
        const userOrder = Array.from(items).map(i => i.dataset.text);
        const isCorrect = JSON.stringify(userOrder) === JSON.stringify(question.muc);
        items.forEach((item, index) => { item.draggable = false; if (item.dataset.text === question.muc[index]) item.classList.add('correct'); else item.classList.add('incorrect'); });
        question.isAnswered = true;
        question.userAnswer = userOrder;
        finalizeAnswer(isCorrect, question);
    }

    function finalizeAnswer(isCorrect, question) {
        if (isCorrect) { correctAnswers++; if (sounds.correct) sounds.correct.play(); } 
        else { incorrectAnswers++; if (sounds.incorrect) sounds.incorrect.play(); }
        updateQuestionNav(isCorrect);
        setTimeout(() => {
            showAnswerState(question);
            updateDashboard();
            if (currentQuestionIndex < activeQuestions.length - 1 && !['noi', 'nhieu_dap_an', 'sap_xep', 'phan_loai', 'dropdown'].includes(question.type)) {
                autoAdvanceTimeout = setTimeout(handleNextQuestion, AUTO_ADVANCE_DELAY);
            }
        }, 100);
    }

    function showAnswerState(question) {
        explanationBoxEl.classList.remove('hidden');
        const expText = question.explanation ? fixMalformedSVG(question.explanation) : "Không có giải thích chi tiết.";
        explanationTextEl.innerHTML = expText;

        const options = optionsContainerEl.querySelectorAll('.option:not(input)');
        
        options.forEach(btn => {
            const key = btn.dataset.answer;
            if (!key) return;

            const isMulti = Array.isArray(question.answer);
            const isCorrectAnswer = isMulti ? question.answer.includes(key) : question.answer === key;
            const isUserSelected = isMulti ? (question.userAnswer && question.userAnswer.includes(key)) : question.userAnswer === key;

            if (isCorrectAnswer) {
                btn.classList.add('correct', 'highlighted');
            }
            if (isUserSelected && !isCorrectAnswer) {
                btn.classList.add('incorrect', 'highlighted');
            }
        });

        if (question.type === 'dien_khuyet') {
            const inputEl = document.getElementById('fill-in-input');
            if (inputEl) {
                const isCorrect = normalizeString(question.userAnswer) === normalizeString(question.answer);
                if (isCorrect) {
                    inputEl.classList.add('correct', 'highlighted');
                } else {
                    inputEl.classList.add('incorrect', 'highlighted');
                }
            }
        }

        if (question.type === 'noi') {
            drawMatchingLines(true);
            
            for (const leftId in matchingState.userMatches) {
                const rightId = matchingState.userMatches[leftId];
                const isMatchCorrect = leftId.split('-')[1] === rightId.split('-')[1];
                const leftEl = document.querySelector(`[data-match-id="${leftId}"]`);
                const rightEl = document.querySelector(`[data-match-id="${rightId}"]`);
                
                if (isMatchCorrect) {
                    if(leftEl) { leftEl.classList.remove('matched'); leftEl.classList.add('correct'); }
                    if(rightEl) { rightEl.classList.remove('matched'); rightEl.classList.add('correct'); }
                } else {
                    if(leftEl) { leftEl.classList.remove('matched'); leftEl.classList.add('incorrect'); }
                    if(rightEl) { rightEl.classList.remove('matched'); rightEl.classList.add('incorrect'); }
                }
            }
        }
    }

    function handleNextQuestion() { 
        if (currentQuestionIndex < activeQuestions.length - 1) { 
            currentQuestionIndex++; 
            displayQuestion(); 
        } else if (!isReviewMode) {
            const confirmSubmit = confirm("Bạn đã hoàn thành câu hỏi cuối cùng.\n\n- Nhấn OK để NỘP BÀI.\n- Nhấn Cancel để XEM LẠI.");
            if (confirmSubmit) endQuiz();
        }
    }

    function handlePrevQuestion() { 
        if (currentQuestionIndex > 0) { 
            if (activeQuestions[currentQuestionIndex].type === 'noi' && !activeQuestions[currentQuestionIndex].isAnswered) activeQuestions[currentQuestionIndex].userAnswer = matchingState.userMatches;
            currentQuestionIndex--; 
            displayQuestion(); 
        } 
    }

    function endQuiz() {
        clearInterval(quizTimer);
        let timeSpentFormatted = document.getElementById('timer-value').textContent;
        let userData = allUsersData[currentUserName] || { cupCount: 0, lifetimeCorrect: 0, topicResults: [], seenQuestionIds: {} };
        allUsersData[currentUserName] = userData;
        userData.lifetimeCorrect += correctAnswers;
        
        const acc = Math.round((correctAnswers / activeQuestions.length) * 100) || 0;

        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyoztj_qCAVbFQhSlj4U0IHrZZwEWlkHQ4NR9VandMGvKw8G4fhhQCuazqPBCr013Ut/exec"; 
        const dataToSend = {
            name: currentUserName,
            topic: currentQuizTitle,
            score: correctAnswers,
            total: activeQuestions.length,
            acc: acc
        };

        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSend)
        }).then(() => console.log("Đã gửi điểm về Trụ sở!")).catch(err => console.error("Lỗi gửi điểm:", err));

        const quizResult = { topic: currentQuizTitle, score: correctAnswers, total: activeQuestions.length, accuracy: acc, date: new Date().toISOString(), timeSpent: timeSpentFormatted };
        userData.topicResults.push(quizResult);
        
        if (acc >= 90) { userData.cupCount++; showVictoryModal(correctAnswers, acc); } 
        else { 
            document.getElementById('final-score').textContent = correctAnswers;
            document.getElementById('final-accuracy').textContent = `${acc}%`;
            document.getElementById('final-correct').textContent = correctAnswers;
            document.getElementById('final-total').textContent = activeQuestions.length;
            resultsModal.classList.remove('hidden'); 
        }

        if (currentMode === 'random') {
             const tName = subjectSelector.value.startsWith('comprehensive_') ? subjectSelector.value : (allTopics[topicSelector.value] ? allTopics[topicSelector.value].name : 'unknown');
             userData.seenQuestionIds[tName] = [...new Set([...(userData.seenQuestionIds[tName]||[]), ...activeQuestions.map(q=>q.id)])];
        }

        localStorage.setItem(ALL_USERS_DB_KEY, JSON.stringify(allUsersData));
        updateUserCupDisplay(); 
        updateDashboard(); 
        displayUserLog(currentUserName); 
        updateLeaderboardUI();   
    }

    function handlePrintSummaryReport() {
        if (!currentUserName) return;
        const userData = allUsersData[currentUserName];
        if (!userData || !userData.topicResults || userData.topicResults.length === 0) { alert("Chưa có kết quả để in."); return; }
        
        const startDateEl = document.getElementById('report-start-date');
        const endDateEl = document.getElementById('report-end-date');
        let filteredResults = userData.topicResults;
        
        if (!startDateEl.value && !endDateEl.value) {
            const today = new Date().toDateString();
            filteredResults = userData.topicResults.filter(log => new Date(log.date).toDateString() === today);
        } else {
            const start = startDateEl.value ? new Date(startDateEl.value) : new Date('2000-01-01');
            const end = endDateEl.value ? new Date(endDateEl.value) : new Date();
            end.setHours(23, 59, 59, 999);
            filteredResults = userData.topicResults.filter(log => { const d = new Date(log.date); return d >= start && d <= end; });
        }
        
        if (filteredResults.length === 0) { alert("Không tìm thấy kết quả trong khoảng thời gian này."); return; }
        
        const totalTests = filteredResults.length;
        const avgAccuracy = Math.round(filteredResults.reduce((sum, log) => sum + log.accuracy, 0) / totalTests);
        const totalCups = userData.cupCount || 0;
        const todayStr = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        let content = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>Bảng Vàng Thành Tích - ${currentUserName}</title>
            <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Nunito', sans-serif; color: #1f2937; line-height: 1.6; padding: 30px; background: #f3f4f6; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .report-container { max-width: 800px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-top: 10px solid #6366f1; }
                .header { text-align: center; border-bottom: 2px dashed #e5e7eb; padding-bottom: 25px; margin-bottom: 30px; }
                .header h1 { color: #4338ca; margin: 0; font-size: 32px; text-transform: uppercase; font-weight: 900; letter-spacing: 1px; }
                .header h2 { font-size: 26px; color: #f59e0b; margin: 10px 0; font-weight: 800; }
                .header p { color: #6b7280; font-size: 14px; margin: 5px 0 0 0; }
                .stats-grid { display: flex; justify-content: space-between; margin-bottom: 35px; gap: 15px; }
                .stat-box { flex: 1; background: #eef2ff; padding: 20px; border-radius: 16px; text-align: center; border: 1px solid #c7d2fe; box-shadow: 0 4px 6px rgba(99,102,241,0.05); }
                .stat-box h3 { margin: 0; font-size: 36px; color: #6366f1; font-weight: 900; line-height: 1; }
                .stat-box p { margin: 8px 0 0 0; font-size: 13px; color: #4f46e5; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
                table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
                th, td { padding: 15px; text-align: left; border-bottom: 1px solid #e5e7eb; }
                th { background-color: #f8fafc; font-weight: 800; color: #475569; text-transform: uppercase; font-size: 13px; }
                tr:last-child td { border-bottom: none; }
                tr:nth-child(even) { background-color: #f8fafc; }
                .acc-badge { padding: 6px 12px; border-radius: 20px; font-weight: 800; font-size: 13px; text-align: center; display: inline-block; min-width: 60px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .acc-high { background: #d1fae5; color: #065f46; border: 1px solid #34d399; }
                .acc-med { background: #fef3c7; color: #92400e; border: 1px solid #fbbf24; }
                .acc-low { background: #fee2e2; color: #991b1b; border: 1px solid #f87171; }
                .footer { text-align: center; margin-top: 40px; font-size: 13px; color: #9ca3af; font-style: italic; border-top: 1px dashed #e5e7eb; padding-top: 20px; font-weight: 600; }
                .score-text { font-weight: 800; color: #1f2937; }
                @media print { 
                    body { background: white; padding: 0; } 
                    .report-container { box-shadow: none; max-width: 100%; border-top-width: 6px; padding: 20px; } 
                }
            </style>
        </head>
        <body>
            <div class="report-container">
                <div class="header">
                    <h1>Bảng Vàng Thành Tích</h1>
                    <h2>🎓 Học giả: ${currentUserName}</h2>
                    <p>Thời gian xuất báo cáo: ${todayStr}</p>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-box">
                        <h3>${totalTests}</h3>
                        <p>Bài Đã Hoàn Thành</p>
                    </div>
                    <div class="stat-box">
                        <h3 style="color: ${avgAccuracy >= 80 ? '#10b981' : avgAccuracy >= 50 ? '#f59e0b' : '#ef4444'};">${avgAccuracy}%</h3>
                        <p>Độ Chính Xác TB</p>
                    </div>
                    <div class="stat-box" style="background: #fffbeb; border-color: #fde68a;">
                        <h3 style="color: #d97706;">🏆 ${totalCups}</h3>
                        <p style="color: #b45309;">Cúp Danh Giá</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Thời gian thi</th>
                            <th>Nội dung bài kiểm tra</th>
                            <th style="text-align: center;">Điểm số</th>
                            <th style="text-align: center;">Tỷ lệ</th>
                        </tr>
                    </thead>
                    <tbody>`;

        filteredResults.reverse().forEach(log => { 
            const d = new Date(log.date);
            const timeStr = d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
            
            let badgeClass = 'acc-low';
            if (log.accuracy >= 80) badgeClass = 'acc-high';
            else if (log.accuracy >= 50) badgeClass = 'acc-med';

            content += `
                <tr>
                    <td style="font-size: 0.9rem; color: #64748b;">${timeStr}</td>
                    <td style="font-weight: 700; color: #334155;">${log.topic}</td>
                    <td style="text-align: center;" class="score-text">${log.score}/${log.total}</td>
                    <td style="text-align: center;"><span class="acc-badge ${badgeClass}">${log.accuracy}%</span></td>
                </tr>`; 
        });

        content += `
                    </tbody>
                </table>

                <div class="footer">
                    🚀 Báo cáo được trích xuất tự động từ Hệ thống Đánh giá Năng lực Chuẩn Ivy League (A80).
                </div>
            </div>
        </body>
        </html>`;

        const printWin = window.open('', '_blank'); 
        printWin.document.write(content); 
        printWin.document.close();
        
        setTimeout(() => { printWin.print(); }, 800);
    }

    function populateSubjectSelector() {
        subjectSelector.innerHTML = '<option value="">--- Vui lòng chọn ---</option>';
        if (allTopics.length === 0) return;
        const subjects = {}; 
        allTopics.forEach(t => { if (!subjects[t.subject]) subjects[t.subject] = []; subjects[t.subject].push(t); });
        Object.keys(subjects).sort().forEach(s => {
            const opt = document.createElement('option'); opt.value = s; opt.textContent = s; subjectSelector.appendChild(opt);
        });
        const compGroup = document.createElement('optgroup'); compGroup.label = "TỔNG HỢP";
        Object.keys(subjects).sort().forEach(s => {
             const opt = document.createElement('option'); opt.value = `comprehensive_${s}`; opt.textContent = `Tổng hợp ${s}`; compGroup.appendChild(opt);
        });
        subjectSelector.appendChild(compGroup);
        handleSubjectChange();
    }

    function handleSubjectChange() {
        const val = subjectSelector.value;
        if (!val || val.startsWith('comprehensive_')) { topicSelector.innerHTML = '<option>---</option>'; topicSelector.disabled = true; } 
        else {
            topicSelector.disabled = false; topicSelector.innerHTML = '<option value="">--- Chọn Bài ---</option>';
            allTopics.filter(t => t.subject === val).forEach(t => {
                const opt = document.createElement('option'); opt.value = t.originalIndex; opt.textContent = t.name; topicSelector.appendChild(opt);
            });
        }
        updateTopicQuestionCount();
        randomizeSlogan();
    }

    function updateTopicQuestionCount() {
        const sVal = subjectSelector.value;
        const tVal = topicSelector.value;
        let count = 0;
        if (sVal.startsWith('comprehensive_')) {
            const subj = sVal.replace('comprehensive_', '');
            count = allTopics.filter(t => t.subject === subj).reduce((a, b) => a + b.questions.length, 0);
        } else if (tVal && allTopics[tVal]) count = allTopics[tVal].questions.length;
        topicTotalQuestionsEl.textContent = count;
    }

    function updateUserCupDisplay() {
        const u = allUsersData[currentUserName];
        if (u) {
            if(dashboardHeaderEl) dashboardHeaderEl.textContent = currentUserName;
            const dashCup = document.getElementById('dash-cup');
            if(dashCup) dashCup.textContent = `🏆 ${u.cupCount || 0}`;
            const cupsEl = document.getElementById('start-screen-cups');
            if (cupsEl) cupsEl.textContent = `🏆 ${u.cupCount || 0}`;
            const levelEl = document.getElementById('start-screen-level');
            if (levelEl) levelEl.textContent = calculateLevel(u.lifetimeCorrect || 0);
        }
    }

    function displayUserLog(name) {
        const list = document.getElementById('user-log-list');
        const u = allUsersData[name];
        if (!u || !u.topicResults) { list.innerHTML = '<li>Chưa có dữ liệu</li>'; return; }
        list.innerHTML = '';
        u.topicResults.slice().reverse().forEach(log => {
            const d = new Date(log.date);
            list.innerHTML += `<li class="log-item"><b>${log.topic}</b>: ${log.score}/${log.total} (${log.accuracy}%) - ${d.toLocaleDateString()}</li>`;
        });
    }

    function showVictoryModal(s, a) { document.getElementById('victory-score').textContent = `${s} (${a}%)`; victoryModal.classList.remove('hidden'); try{ sounds.victory.play(); }catch(e){} }
    function startReviewMode() { isReviewMode = true; resultsModal.classList.add('hidden'); victoryModal.classList.add('hidden'); displayQuestion(); updateDashboard(); }
    function resetQuizView() { location.reload(); }

    function updateLeaderboardUI() {
        const list = document.getElementById('leaderboard-list');
        if (!list) return;
        list.innerHTML = '';
        const sortedUsers = Object.entries(allUsersData).sort((a, b) => (b[1].cupCount || 0) - (a[1].cupCount || 0));
        sortedUsers.slice(0, 5).forEach((userEntry, index) => {
            const userName = userEntry[0];
            const li = document.createElement('li');
            li.innerHTML = `<span>${index+1}. <b>${userName}</b></span><span>🏆 ${userEntry[1].cupCount || 0}</span>`;
            list.appendChild(li);
        });
    }

    function updateDashboard() {
        if (document.getElementById('score-value')) document.getElementById('score-value').textContent = lifetimeCorrect;
        if (document.getElementById('correct-value')) document.getElementById('correct-value').textContent = correctAnswers;
        if (document.getElementById('incorrect-value')) document.getElementById('incorrect-value').textContent = incorrectAnswers;
        const total = activeQuestions.length;
        const currentProgress = activeQuestions.length > 0 ? ((correctAnswers + incorrectAnswers) / activeQuestions.length) * 100 : 0;
        if (document.getElementById('progress-bar')) { document.getElementById('progress-bar').style.width = `${currentProgress}%`; document.getElementById('progress-bar').textContent = `${Math.round(currentProgress)}%`; }
        const answered = correctAnswers + incorrectAnswers;
        if (document.getElementById('accuracy-value')) document.getElementById('accuracy-value').textContent = answered > 0 ? `${Math.round((correctAnswers / answered) * 100)}%` : '0%';
    }
    
    function createQuestionNav() {
        questionNavGridEl.innerHTML = '';
        activeQuestions.forEach((_, i) => {
            const navItem = document.createElement('div'); navItem.className = 'nav-item'; navItem.id = `nav-item-${i}`; navItem.textContent = i + 1;
            navItem.addEventListener('click', () => { clearTimeout(autoAdvanceTimeout); currentQuestionIndex = i; displayQuestion(); });
            questionNavGridEl.appendChild(navItem);
        });
    }
    
    function updateQuestionNav(status) {
        const item = document.getElementById(`nav-item-${currentQuestionIndex}`);
        if(item && status !== undefined) { item.classList.remove('current'); item.classList.add(status ? 'correct' : 'incorrect'); }
    }
    
    function startTimer() {
        clearInterval(quizTimer);
        let seconds = 0; 
        if (isReviewMode) { document.getElementById('timer-value').textContent = 'Xem lại'; return; }
        quizStartTime = new Date(); 
        quizTimer = setInterval(() => {
            seconds++; document.getElementById('timer-value').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        }, 1000);
    }

    // ==========================================================================
    //  7. AI GURU
    // ==========================================================================

    async function callAIGuru(questionObj) {
        aiResponseArea.classList.remove('hidden');
        aiContentText.innerHTML = "🤖 <i>Gia sư Ivy League đang suy nghĩ...</i>"; 
        
        try {
            const response = await fetch('https://still-fog-44ed.phungtriduc.workers.dev/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: questionObj.question,
                    userAnswer: questionObj.userAnswer,
                    correctAnswer: questionObj.answer,
                    type: questionObj.type,
                    role: "Ivy League STEM Tutor"
                })
            });
            const data = await response.json();
            
            let formattedReply = data.reply
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')   
                .replace(/\n/g, '<br>');                  

            aiContentText.innerHTML = formattedReply;

            if (window.MathJax) {
                MathJax.typesetPromise([aiContentText]).catch((err) => console.log(err));
            }

        } catch (error) {
            console.error(error);
            aiContentText.textContent = "❌ Lỗi kết nối AI. Kiểm tra lại đường truyền nhé Bruno!";
        }
    }

    // ==========================================================================
    //  8. INIT
    // ==========================================================================

    const newGameBtn = document.getElementById('new-random-btn');
    const newGameVicBtn = document.getElementById('new-random-victory-btn');
    
    const startNewGame = () => {
        resultsModal.classList.add('hidden');
        victoryModal.classList.add('hidden');
        startQuiz('random'); 
    };

    if(newGameBtn) newGameBtn.addEventListener('click', startNewGame);
    if(newGameVicBtn) newGameVicBtn.addEventListener('click', startNewGame);

    const reviewVicBtn = document.getElementById('review-victory-btn');
    if(reviewVicBtn) reviewVicBtn.addEventListener('click', startReviewMode);

    const homeVicBtn = document.getElementById('go-home-victory-btn');
    if(homeVicBtn) homeVicBtn.addEventListener('click', resetQuizView);

    const printDetailBtn = document.getElementById('print-detail-report-btn');
    const printVicBtn = document.getElementById('print-detail-victory-btn');
    
    if(printDetailBtn) printDetailBtn.addEventListener('click', handlePrintSummaryReport);
    if(printVicBtn) printVicBtn.addEventListener('click', handlePrintSummaryReport);

    async function initializeApp() {
        allUsersData = JSON.parse(localStorage.getItem(ALL_USERS_DB_KEY)) || {};
        const lastUser = localStorage.getItem(LAST_USER_KEY);
        
        await loadAndParseAllTopics();
        
        updateLeaderboardUI();
        
        if (lastUser && allUsersData[lastUser]) {
            currentUserName = lastUser;
            document.getElementById('welcome-user').classList.remove('hidden');
            document.getElementById('welcome-prompt').classList.add('hidden');
            document.getElementById('user-signature').textContent = currentUserName;
            document.getElementById('user-log-container').classList.remove('hidden');
            updateUserCupDisplay();
            displayUserLog(currentUserName);
        } else {
            document.getElementById('welcome-user').classList.add('hidden');
            document.getElementById('welcome-prompt').classList.remove('hidden'); 
        }

        populateSubjectSelector();
    }

    document.getElementById('start-random-btn').addEventListener('click', () => startQuiz('random'));
    document.getElementById('start-full-btn').addEventListener('click', () => startQuiz('full'));
    subjectSelector.addEventListener('change', handleSubjectChange);
    topicSelector.addEventListener('change', updateTopicQuestionCount);
    nextQuestionBtn.addEventListener('click', handleNextQuestion);
    if(prevQuestionBtn) prevQuestionBtn.addEventListener('click', handlePrevQuestion);
    stopQuizBtn.addEventListener('click', resetQuizView);
    document.getElementById('go-home-btn').addEventListener('click', resetQuizView);
    document.getElementById('review-btn').addEventListener('click', startReviewMode);
    
    const printBtn = document.getElementById('print-summary-report-btn');
    if(printBtn) printBtn.addEventListener('click', handlePrintSummaryReport);
    
    document.getElementById('name-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const name = e.target.value.trim();
            if (name.length > 0) {
                localStorage.setItem(LAST_USER_KEY, name);
                if (!allUsersData[name]) { 
                    allUsersData[name] = { cupCount: 0, lifetimeCorrect: 0, topicResults: [], seenQuestionIds: {} }; 
                    localStorage.setItem(ALL_USERS_DB_KEY, JSON.stringify(allUsersData)); 
                }
                initializeApp();
            } else { 
                alert("Vui lòng nhập tên hợp lệ!"); 
            }
        }
    });

    document.getElementById('change-name-btn').addEventListener('click', () => { 
        localStorage.removeItem(LAST_USER_KEY); 
        initializeApp(); 
    });
    
    document.getElementById('reset-db-btn').addEventListener('click', () => { 
        if(confirm("Xóa toàn bộ dữ liệu?")) { 
            localStorage.clear(); 
            location.reload(); 
        } 
    });

    document.querySelectorAll('.collapsed h3').forEach(h => h.addEventListener('click', function() {
        this.parentElement.classList.toggle('collapsed');
    }));

    if (askAiBtn) {
        askAiBtn.onclick = () => {
            if (!activeQuestions || activeQuestions.length === 0) return;
            const currentQ = activeQuestions[currentQuestionIndex];
            
            if (!currentQ.isAnswered) {
                alert("🚫 Kỷ luật là sức mạnh! Woodie phải tự hoàn thành câu hỏi này trước khi hỏi Gia sư AI.");
                return;
            }
            
            callAIGuru(currentQ);
        };
    }

    initializeApp();


});

