// ========== 本地存储封装 ==========
const storage = {
    get: (key) => JSON.parse(localStorage.getItem(key) || '[]'),
    set: (key, value) => localStorage.setItem(key, JSON.stringify(value))
};

// ========== GitHub Gist API ==========
const ghGists = {
    baseUrl: 'https://api.github.com/gists',

    getToken() {
        return localStorage.getItem('gh_token');
    },

    setToken(token) {
        localStorage.setItem('gh_token', token);
    },

    async request(method, endpoint, body = null) {
        const token = this.getToken();
        if (!token) {
            throw new Error('未设置 GitHub Token，请在设置中输入');
        }

        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
            options.headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(this.baseUrl + endpoint, options);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || `请求失败: ${response.status}`);
        }
        return response.json();
    },

    async create(filename, content, description = '') {
        return this.request('POST', '/', {
            description,
            public: false,
            files: { [filename]: { content } }
        });
    },

    async list() {
        return this.request('GET', '?per_page=100');
    },

    async update(gistId, filename, content) {
        return this.request('PATCH', `/${gistId}`, {
            files: { [filename]: { content } }
        });
    },

    async delete(gistId) {
        return this.request('DELETE', `/${gistId}`);
    }
};

// ========== Gist 文件名工具 ==========
const GIST_PREFIX = 'diary-';
const GIST_SUFFIX = '.json';

function diaryToGistFilename(id) {
    return `${GIST_PREFIX}${id}${GIST_SUFFIX}`;
}

function parseGistFilename(filename) {
    if (!filename.startsWith(GIST_PREFIX) || !filename.endsWith(GIST_SUFFIX)) {
        return null;
    }
    const idStr = filename.slice(GIST_PREFIX.length, -GIST_SUFFIX.length);
    return parseInt(idStr, 10);
}

// 内存缓存：gistId <-> diaryId 的映射
let gistIdMap = {}; // { diaryId: gistId }
let mapLoaded = false;

// ========== 密码生成器 ==========
function generatePassword() {
    const length = document.getElementById('pwd-length').value;
    const useUpper = document.getElementById('pwd-upper').checked;
    const useLower = document.getElementById('pwd-lower').checked;
    const useNumber = document.getElementById('pwd-number').checked;
    const useSymbol = document.getElementById('pwd-symbol').checked;

    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let chars = '';
    if (useUpper) chars += upper;
    if (useLower) chars += lower;
    if (useNumber) chars += numbers;
    if (useSymbol) chars += symbols;

    if (!chars) {
        alert('请至少选择一种字符类型');
        return;
    }

    let password = '';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);

    for (let i = 0; i < length; i++) {
        password += chars[array[i] % chars.length];
    }

    document.getElementById('password-output').value = password;
}

function copyPassword() {
    const output = document.getElementById('password-output');
    if (output.value) {
        navigator.clipboard.writeText(output.value).then(() => {
            const btn = event.target;
            const original = btn.textContent;
            btn.textContent = '已复制!';
            setTimeout(() => btn.textContent = original, 1500);
        });
    }
}

// 更新密码长度显示
document.getElementById('pwd-length')?.addEventListener('input', function() {
    document.getElementById('pwd-length-val').textContent = this.value;
});

// ========== 待办事项 ==========
function loadTodos() {
    const todos = storage.get('todos');
    renderTodos(todos);
}

function renderTodos(todos) {
    const list = document.getElementById('todo-list');
    if (!list) return;

    list.innerHTML = todos.map((todo, index) => `
        <li class="todo-item ${todo.completed ? 'completed' : ''}">
            <input type="checkbox" ${todo.completed ? 'checked' : ''} onchange="toggleTodo(${index})">
            <span>${escapeHtml(todo.text)}</span>
            <button onclick="deleteTodo(${index})">删除</button>
        </li>
    `).join('');
}

function addTodo() {
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    if (!text) return;

    const todos = storage.get('todos');
    todos.push({ text, completed: false, createdAt: Date.now() });
    storage.set('todos', todos);

    input.value = '';
    renderTodos(todos);
}

function toggleTodo(index) {
    const todos = storage.get('todos');
    todos[index].completed = !todos[index].completed;
    storage.set('todos', todos);
    renderTodos(todos);
}

function deleteTodo(index) {
    const todos = storage.get('todos');
    todos.splice(index, 1);
    storage.set('todos', todos);
    renderTodos(todos);
}

// 回车添加待办
document.getElementById('todo-input')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addTodo();
});

// ========== 计时器 ==========
let timerInterval = null;
let timerSeconds = 25 * 60;

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateTimerDisplay() {
    document.getElementById('timer-display').textContent = formatTime(timerSeconds);
}

function startTimer() {
    if (timerInterval) return;

    timerInterval = setInterval(() => {
        if (timerSeconds > 0) {
            timerSeconds--;
            updateTimerDisplay();
        } else {
            pauseTimer();
            alert('时间到！');
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function resetTimer() {
    pauseTimer();
    timerSeconds = 25 * 60;
    updateTimerDisplay();
}

function setTimer(minutes) {
    pauseTimer();
    timerSeconds = minutes * 60;
    updateTimerDisplay();
}

// ========== 进制转换 ==========
function convertFromDec() {
    const dec = parseInt(document.getElementById('dec-input').value);
    if (isNaN(dec)) return;

    document.getElementById('bin-input').value = dec.toString(2);
    document.getElementById('hex-input').value = dec.toString(16).toUpperCase();
}

function convertFromBin() {
    const bin = document.getElementById('bin-input').value;
    if (!/^[01]+$/.test(bin)) return;

    const dec = parseInt(bin, 2);
    document.getElementById('dec-input').value = dec;
    document.getElementById('hex-input').value = dec.toString(16).toUpperCase();
}

function convertFromHex() {
    const hex = document.getElementById('hex-input').value;
    if (!/^[0-9A-Fa-f]+$/.test(hex)) return;

    const dec = parseInt(hex, 16);
    document.getElementById('dec-input').value = dec;
    document.getElementById('bin-input').value = dec.toString(2);
}

function clearConverter() {
    document.getElementById('dec-input').value = '';
    document.getElementById('bin-input').value = '';
    document.getElementById('hex-input').value = '';
}

// ========== 字节转换 ==========
function convertBytes(bytes) {
    if (!bytes) return;
    const n = parseFloat(bytes);
    document.getElementById('kb').value = (n / 1024).toFixed(4);
    document.getElementById('mb').value = (n / 1024 / 1024).toFixed(6);
    document.getElementById('gb').value = (n / 1024 / 1024 / 1024).toFixed(8);
}

function convertKB(kb) {
    if (!kb) return;
    const n = parseFloat(kb);
    document.getElementById('bytes').value = Math.round(n * 1024);
    document.getElementById('mb').value = (n / 1024).toFixed(6);
    document.getElementById('gb').value = (n / 1024 / 1024).toFixed(8);
}

function convertMB(mb) {
    if (!mb) return;
    const n = parseFloat(mb);
    document.getElementById('bytes').value = Math.round(n * 1024 * 1024);
    document.getElementById('kb').value = (n * 1024).toFixed(4);
    document.getElementById('gb').value = (n / 1024).toFixed(8);
}

function convertGB(gb) {
    if (!gb) return;
    const n = parseFloat(gb);
    document.getElementById('bytes').value = Math.round(n * 1024 * 1024 * 1024);
    document.getElementById('kb').value = (n * 1024 * 1024).toFixed(4);
    document.getElementById('mb').value = (n * 1024).toFixed(6);
}

// ========== JSON 格式化 ==========
function formatJSON() {
    const input = document.getElementById('json-input');
    try {
        const obj = JSON.parse(input.value);
        input.value = JSON.stringify(obj, null, 2);
    } catch (e) {
        alert('JSON 格式错误: ' + e.message);
    }
}

function minifyJSON() {
    const input = document.getElementById('json-input');
    try {
        const obj = JSON.parse(input.value);
        input.value = JSON.stringify(obj);
    } catch (e) {
        alert('JSON 格式错误: ' + e.message);
    }
}

function clearJSON() {
    document.getElementById('json-input').value = '';
}

// ========== 日记功能 ==========
let currentTags = [];
let diariesCache = []; // 内存缓存

// 设置今天的日期
document.getElementById('diary-date')?.addEventListener('DOMContentLoaded', function() {
    this.valueAsDate = new Date();
});

async function loadDiaries() {
    const container = document.getElementById('diary-entries');
    if (container) container.innerHTML = '<div class="empty-state">加载中...</div>';

    const token = ghGists.getToken();
    if (!token) {
        // 无 Token，使用本地存储
        diariesCache = storage.get('diaries');
        renderDiaries(diariesCache);
        return;
    }

    try {
        const gistData = await ghGists.list();
        const diaries = [];
        gistIdMap = {};

        for (const gist of gistData) {
            // 找到 diary-*.json 文件
            const diaryFile = Object.values(gist.files).find(f =>
                f.filename.startsWith(GIST_PREFIX) && f.filename.endsWith(GIST_SUFFIX)
            );
            if (!diaryFile) continue;

            try {
                const diary = JSON.parse(diaryFile.content);
                diary.gistId = gist.id;
                diaries.push(diary);
                gistIdMap[diary.id] = gist.id;
            } catch (e) {
                console.warn('解析日记失败:', diaryFile.filename, e);
            }
        }

        diariesCache = diaries;
        // 同步到 localStorage
        storage.set('diaries', diaries);
        mapLoaded = true;
        renderDiaries(diaries);
    } catch (err) {
        alert('加载日记失败: ' + err.message);
        diariesCache = storage.get('diaries');
        renderDiaries(diariesCache);
    }
}

function renderDiaries(diaries) {
    const container = document.getElementById('diary-entries');
    if (!container) return;

    if (!diaries || diaries.length === 0) {
        container.innerHTML = '<div class="empty-state">还没有日记，写点什么吧 ✍️</div>';
        return;
    }

    // 按日期倒序
    diaries.sort((a, b) => b.date.localeCompare(a.date));

    container.innerHTML = diaries.map((diary) => `
        <div class="diary-entry">
            <h3>${escapeHtml(diary.title)}</h3>
            <div class="date">${diary.date}</div>
            <div class="content">${escapeHtml(diary.content)}</div>
            ${diary.tags?.length ? `
                <div class="entry-tags">
                    ${diary.tags.map(tag => `<span class="entry-tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="actions">
                <button onclick="editDiary(${diary.id})">编辑</button>
                <button onclick="deleteDiary(${diary.id})" class="btn-danger">删除</button>
            </div>
        </div>
    `).join('');
}

async function saveDiary() {
    const date = document.getElementById('diary-date').value;
    const title = document.getElementById('diary-title').value.trim();
    const content = document.getElementById('diary-content').value.trim();

    if (!date || !title || !content) {
        alert('请填写日期、标题和内容');
        return;
    }

    const token = ghGists.getToken();
    const editId = document.getElementById('diary-title').dataset.editId;

    if (editId) {
        // 编辑模式
        const index = diariesCache.findIndex(d => d.id == editId);
        if (index !== -1) {
            const diary = { id: parseInt(editId), date, title, content, tags: currentTags };
            diariesCache[index] = diary;

            if (token && gistIdMap[editId]) {
                try {
                    await ghGists.update(gistIdMap[editId], diaryToGistFilename(editId), JSON.stringify(diary));
                } catch (err) {
                    alert('更新到 GitHub 失败: ' + err.message);
                }
            }
        }
        delete document.getElementById('diary-title').dataset.editId;
    } else {
        // 新建
        const id = Date.now();
        const diary = { id, date, title, content, tags: currentTags };
        diariesCache.push(diary);

        if (token) {
            try {
                const gist = await ghGists.create(
                    diaryToGistFilename(id),
                    JSON.stringify(diary),
                    `Diary: ${title}`
                );
                gistIdMap[id] = gist.id;
            } catch (err) {
                alert('同步到 GitHub 失败: ' + err.message);
            }
        }
    }

    storage.set('diaries', diariesCache);

    // 清空表单
    document.getElementById('diary-title').value = '';
    document.getElementById('diary-content').value = '';
    document.getElementById('diary-tag-input').value = '';
    currentTags = [];
    renderTags();

    renderDiaries(diariesCache);
}

function editDiary(id) {
    const diary = diariesCache.find(d => d.id == id);
    if (!diary) return;

    document.getElementById('diary-date').value = diary.date;
    document.getElementById('diary-title').value = diary.title;
    document.getElementById('diary-content').value = diary.content;
    document.getElementById('diary-title').dataset.editId = id;

    currentTags = diary.tags || [];
    renderTags();
}

async function deleteDiary(id) {
    if (!confirm('确定要删除这篇日记吗？')) return;

    diariesCache = diariesCache.filter(d => d.id != id);

    const token = ghGists.getToken();
    if (token && gistIdMap[id]) {
        try {
            await ghGists.delete(gistIdMap[id]);
            delete gistIdMap[id];
        } catch (err) {
            alert('从 GitHub 删除失败: ' + err.message);
        }
    }

    storage.set('diaries', diariesCache);
    renderDiaries(diariesCache);
}

function searchDiaries() {
    const keyword = document.getElementById('search-diary').value.toLowerCase();
    const filtered = diariesCache.filter(d =>
        d.title.toLowerCase().includes(keyword) ||
        d.content.toLowerCase().includes(keyword)
    );
    renderDiaries(filtered);
}

// ========== GitHub 设置 ==========
function toggleGhSettings() {
    const panel = document.getElementById('gh-settings-panel');
    const input = document.getElementById('gh-token-input');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        input.value = ghGists.getToken() || '';
    } else {
        panel.style.display = 'none';
    }
}

function saveGhToken() {
    const token = document.getElementById('gh-token-input').value.trim();
    if (!token) {
        alert('请输入 Token');
        return;
    }
    ghGists.setToken(token);
    alert('Token 已保存！现在写日记会自动同步到 GitHub Gist');
    document.getElementById('gh-settings-panel').style.display = 'none';
    loadDiaries(); // 重新加载日记
}

function clearGhToken() {
    localStorage.removeItem('gh_token');
    alert('Token 已清除');
}

// 标签功能
function renderTags() {
    const container = document.getElementById('tag-list');
    if (!container) return;

    container.innerHTML = currentTags.map((tag, index) => `
        <span class="tag">
            ${escapeHtml(tag)}
            <button onclick="removeTag(${index})">×</button>
        </span>
    `).join('');
}

function removeTag(index) {
    currentTags.splice(index, 1);
    renderTags();
}

document.getElementById('diary-tag-input')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const tag = this.value.trim();
        if (tag && !currentTags.includes(tag)) {
            currentTags.push(tag);
            renderTags();
            this.value = '';
        }
    }
});

// ========== 工具函数 ==========
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== 全局搜索 ==========
const searchData = {
    tools: [
        { id: 'password', name: '密码生成器', desc: '生成随机安全密码', url: 'tools.html', type: '工具' },
        { id: 'todo', name: '待办事项', desc: '管理你的任务清单', url: 'tools.html', type: '工具' },
        { id: 'timer', name: '专注计时器', desc: '番茄工作法计时器', url: 'tools.html', type: '工具' },
        { id: 'converter', name: '进制转换', desc: '十进制/二进制/十六进制转换', url: 'tools.html', type: '工具' },
        { id: 'bytes', name: '字节转换', desc: 'B/KB/MB/GB 单位转换', url: 'tools.html', type: '工具' },
        { id: 'json', name: 'JSON 格式化', desc: '格式化和压缩 JSON', url: 'tools.html', type: '工具' }
    ]
};

function performGlobalSearch() {
    const input = document.getElementById('global-search-input');
    const dropdown = document.getElementById('search-results');
    const keyword = input.value.trim().toLowerCase();

    if (!keyword) {
        dropdown.classList.remove('active');
        return;
    }

    const results = [];

    // 搜索工具
    searchData.tools.forEach(tool => {
        if (tool.name.toLowerCase().includes(keyword) || tool.desc.toLowerCase().includes(keyword)) {
            results.push({ ...tool, action: () => { window.location.href = tool.url; } });
        }
    });

    // 搜索日记
    const diaries = storage.get('diaries');
    diaries.forEach(diary => {
        if (diary.title.toLowerCase().includes(keyword) || diary.content.toLowerCase().includes(keyword)) {
            results.push({
                name: diary.title,
                desc: diary.content.substring(0, 50) + '...',
                type: '日记',
                action: () => { window.location.href = 'diary.html'; }
            });
        }
    });

    // 搜索项目
    const projects = storage.get('projects');
    projects.forEach(project => {
        if (project.title.toLowerCase().includes(keyword) || project.desc.toLowerCase().includes(keyword)) {
            results.push({
                name: project.title,
                desc: project.desc.substring(0, 50) + '...',
                type: '项目',
                action: () => {
                    window.location.href = 'projects.html';
                    setTimeout(() => showProjectDetail(project.id), 100);
                }
            });
        }
    });

    // 渲染结果
    if (results.length === 0) {
        dropdown.innerHTML = '<div class="search-no-results">没有找到相关结果</div>';
    } else {
        dropdown.innerHTML = results.map(r => `
            <div class="search-result-item" onclick="(${r.action.toString()})()">
                <div class="result-type">${r.type}</div>
                <div class="result-title">${escapeHtml(r.name)}</div>
                <div class="result-desc">${escapeHtml(r.desc)}</div>
            </div>
        `).join('');
    }

    dropdown.classList.add('active');
}

// 点击外部关闭搜索下拉
document.addEventListener('click', (e) => {
    const searchBox = document.querySelector('.global-search');
    if (searchBox && !searchBox.contains(e.target)) {
        const dropdown = document.getElementById('search-results');
        if (dropdown) dropdown.classList.remove('active');
    }
});

// 回车搜索
document.getElementById('global-search-input')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        performGlobalSearch();
    }
});

// ========== 项目功能 ==========
let currentProjectId = null;

function loadProjects() {
    const projects = storage.get('projects');
    renderProjects(projects);
}

function renderProjects(projects) {
    const container = document.getElementById('projects-container');
    if (!container) return;

    if (projects.length === 0) {
        container.innerHTML = '<div class="empty-state">还没有项目，添加一个吧 🚀</div>';
        return;
    }

    // 按时间倒序
    projects.sort((a, b) => b.createdAt - a.createdAt);

    container.innerHTML = projects.map(project => `
        <div class="project-item" onclick="showProjectDetail(${project.id})">
            <h3>${escapeHtml(project.title)}</h3>
            <p>${escapeHtml(project.desc)}</p>
            <div class="project-meta">
                <div class="project-tags">
                    ${(project.tags || []).slice(0, 3).map(tag =>
                        `<span class="project-tag">${escapeHtml(tag)}</span>`
                    ).join('')}
                </div>
                <span>${formatDate(project.createdAt)}</span>
            </div>
        </div>
    `).join('');
}

function showAddProjectForm() {
    const form = document.getElementById('add-project-form');
    if (form) form.style.display = 'block';
}

function hideAddProjectForm() {
    const form = document.getElementById('add-project-form');
    if (form) {
        form.style.display = 'none';
        // 清空表单
        document.getElementById('project-title').value = '';
        document.getElementById('project-link').value = '';
        document.getElementById('project-desc').value = '';
        document.getElementById('project-tags').value = '';
    }
}

function saveProject() {
    const title = document.getElementById('project-title').value.trim();
    const link = document.getElementById('project-link').value.trim();
    const desc = document.getElementById('project-desc').value.trim();
    const tagsInput = document.getElementById('project-tags').value.trim();

    if (!title || !desc) {
        alert('请填写项目名称和描述');
        return;
    }

    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

    const projects = storage.get('projects');
    projects.push({
        id: Date.now(),
        title,
        link,
        desc,
        tags,
        createdAt: Date.now()
    });

    storage.set('projects', projects);
    hideAddProjectForm();
    renderProjects(projects);
}

function showProjectDetail(id) {
    const projects = storage.get('projects');
    const project = projects.find(p => p.id === id);
    if (!project) return;

    currentProjectId = id;

    const detailSection = document.getElementById('project-detail');
    document.getElementById('detail-title').textContent = project.title;

    let content = project.desc;
    if (project.link) {
        content += `\n\n🔗 链接: ${project.link}`;
    }
    document.getElementById('detail-content').innerHTML = escapeHtml(content).replace(
        /(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>'
    ).replace(/\n/g, '<br>');

    const tagsContainer = document.getElementById('detail-tags');
    tagsContainer.innerHTML = (project.tags || []).map(tag =>
        `<span class="entry-tag">${escapeHtml(tag)}</span>`
    ).join('');

    detailSection.style.display = 'block';

    // 加载评论
    loadComments(id);
}

function closeProjectDetail() {
    const detailSection = document.getElementById('project-detail');
    if (detailSection) detailSection.style.display = 'none';
    currentProjectId = null;
}

function searchProjects() {
    const keyword = document.getElementById('search-project').value.toLowerCase();
    const projects = storage.get('projects');

    const filtered = projects.filter(p =>
        p.title.toLowerCase().includes(keyword) ||
        p.desc.toLowerCase().includes(keyword) ||
        (p.tags || []).some(t => t.toLowerCase().includes(keyword))
    );

    renderProjects(filtered);
}

// ========== 评论功能 ==========
function loadComments(projectId) {
    const allComments = storage.get('comments');
    const comments = allComments.filter(c => c.projectId === projectId);
    renderComments(comments);
}

function renderComments(comments) {
    const container = document.getElementById('comments-list');
    if (!container) return;

    if (comments.length === 0) {
        container.innerHTML = '<div class="no-comments">暂无评论，来发表第一条吧 💬</div>';
        return;
    }

    // 按时间倒序
    comments.sort((a, b) => b.createdAt - a.createdAt);

    container.innerHTML = comments.map(comment => `
        <div class="comment-item">
            <div class="comment-header">
                <span class="comment-author">${escapeHtml(comment.author || '匿名')}</span>
                <span class="comment-time">${formatDate(comment.createdAt)}</span>
            </div>
            <div class="comment-content">${escapeHtml(comment.content)}</div>
            <div class="comment-actions">
                <button onclick="deleteComment(${comment.id})" class="btn-small">删除</button>
            </div>
        </div>
    `).join('');
}

function addComment() {
    if (!currentProjectId) return;

    const author = document.getElementById('comment-author').value.trim() || '匿名';
    const content = document.getElementById('comment-content').value.trim();

    if (!content) {
        alert('请输入评论内容');
        return;
    }

    const comments = storage.get('comments');
    comments.push({
        id: Date.now(),
        projectId: currentProjectId,
        author,
        content,
        createdAt: Date.now()
    });

    storage.set('comments', comments);

    // 清空表单
    document.getElementById('comment-content').value = '';

    loadComments(currentProjectId);
}

function deleteComment(commentId) {
    if (!confirm('确定要删除这条评论吗？')) return;

    let comments = storage.get('comments');
    comments = comments.filter(c => c.id !== commentId);
    storage.set('comments', comments);

    loadComments(currentProjectId);
}

// ========== 工具函数 ==========
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    // 设置今天的日期
    const dateInput = document.getElementById('diary-date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    // 加载数据
    loadTodos();
    loadDiaries();
    loadProjects();
    loadContents();
});


// ========== 内容中心 ==========
let contentCache = [];
let currentContentId = null;

async function loadContents() {
    const listContainer = document.getElementById('content-list');
    if (!listContainer) return;

    try {
        const response = await fetch('content/index.json');
        if (!response.ok) throw new Error('加载内容索引失败');
        contentCache = await response.json();
        renderContentList(contentCache);
    } catch (err) {
        console.error(err);
        listContainer.innerHTML = '<div class="empty-state">加载失败，请检查 content/index.json 是否存在</div>';
    }
}

function renderContentList(items) {
    const container = document.getElementById('content-list');
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无内容</div>';
        return;
    }

    container.innerHTML = items.map(item => {
        const typeInfo = getContentTypeInfo(item.type);
        const isActive = currentContentId === item.id ? 'active' : '';
        return `
            <div class="content-item ${isActive}" onclick="showContentDetail('${item.id}')">
                <div class="item-header">
                    <span class="item-type ${item.type}">${typeInfo.label}</span>
                    <span class="item-title">${escapeHtml(item.title)}</span>
                </div>
                <div class="item-summary">${escapeHtml(item.summary || '')}</div>
                <div class="item-meta">
                    <span>${item.date || ''}</span>
                    ${(item.tags || []).map(tag => `<span class="entry-tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function getContentTypeInfo(type) {
    const map = {
        article: { label: '文章', icon: '📝' },
        video: { label: '视频', icon: '🎬' },
        demo: { label: '演示', icon: '🎨' }
    };
    return map[type] || { label: '内容', icon: '📄' };
}

async function showContentDetail(id) {
    const item = contentCache.find(c => c.id === id);
    if (!item) return;

    currentContentId = id;
    renderContentList(contentCache);

    const main = document.getElementById('content-main');
    if (!main) return;

    main.classList.remove('empty');
    const typeInfo = getContentTypeInfo(item.type);

    let bodyHtml = '';
    let actionsHtml = '';

    try {
        if (item.type === 'article') {
            const response = await fetch(`content/${item.file}`);
            const md = await response.text();
            if (typeof marked !== 'undefined') {
                bodyHtml = `<div class="content-body">${marked.parse(md)}</div>`;
            } else {
                // 按需加载 marked.js
                bodyHtml = '<div class="empty-state">正在加载 Markdown 渲染器...</div>';
                loadMarkedScript().then(() => {
                    const parsed = typeof marked !== 'undefined' ? marked.parse(md) : escapeHtml(md);
                    const bodyEl = main.querySelector('.content-body');
                    if (bodyEl) bodyEl.innerHTML = parsed;
                }).catch(err => {
                    const bodyEl = main.querySelector('.content-body');
                    if (bodyEl) bodyEl.innerHTML = `<pre style="white-space:pre-wrap">${escapeHtml(md)}</pre>`;
                });
            }
        } else if (item.type === 'video') {
            bodyHtml = `
                <div class="content-media">
                    <video controls src="content/${item.file}"></video>
                </div>
                <div class="content-body">
                    <p>${escapeHtml(item.summary || '')}</p>
                </div>
            `;
        } else if (item.type === 'demo') {
            bodyHtml = `
                <div class="content-actions">
                    <button onclick="window.open('content/${item.file}', '_blank')">新标签页打开</button>
                </div>
                <div class="content-media">
                    <iframe src="content/${item.file}" allow="fullscreen"></iframe>
                </div>
                <div class="content-body">
                    <p>${escapeHtml(item.summary || '')}</p>
                </div>
            `;
        }
    } catch (err) {
        bodyHtml = `<div class="empty-state">加载内容失败: ${escapeHtml(err.message)}</div>`;
    }

    main.innerHTML = `
        <div class="content-header">
            <h2>${typeInfo.icon} ${escapeHtml(item.title)}</h2>
            <div class="content-meta">
                <span>📅 ${item.date || '无日期'}</span>
                <span>🏷️ ${(item.tags || []).join(', ') || '无标签'}</span>
            </div>
        </div>
        ${actionsHtml}
        ${bodyHtml}
    `;

    // 移动端滚动到详情区域
    if (window.innerWidth <= 900) {
        main.scrollIntoView({ behavior: 'smooth' });
    }
}

function loadMarkedScript() {
    return new Promise((resolve, reject) => {
        if (typeof marked !== 'undefined') return resolve();
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('加载 Markdown 渲染器失败'));
        document.head.appendChild(script);
    });
}

function searchContents() {
    const keyword = document.getElementById('content-search')?.value.trim().toLowerCase();
    if (!keyword) {
        renderContentList(contentCache);
        return;
    }

    const filtered = contentCache.filter(item =>
        item.title.toLowerCase().includes(keyword) ||
        (item.summary && item.summary.toLowerCase().includes(keyword)) ||
        (item.tags || []).some(t => t.toLowerCase().includes(keyword))
    );
    renderContentList(filtered);
}

// 扩展全局搜索以支持内容
(function extendSearch() {
    const original = performGlobalSearch;
    window.performGlobalSearch = function() {
        const input = document.getElementById('global-search-input');
        const dropdown = document.getElementById('search-results');
        const keyword = input?.value.trim().toLowerCase();

        if (!keyword) {
            dropdown?.classList.remove('active');
            return;
        }

        const results = [];

        // 搜索工具
        searchData.tools.forEach(tool => {
            if (tool.name.toLowerCase().includes(keyword) || tool.desc.toLowerCase().includes(keyword)) {
                results.push({ ...tool, action: () => { window.location.href = tool.url; } });
            }
        });

        // 搜索日记
        const diaries = storage.get('diaries');
        diaries.forEach(diary => {
            if (diary.title.toLowerCase().includes(keyword) || diary.content.toLowerCase().includes(keyword)) {
                results.push({
                    name: diary.title,
                    desc: diary.content.substring(0, 50) + '...',
                    type: '日记',
                    action: () => { window.location.href = 'diary.html'; }
                });
            }
        });

        // 搜索项目
        const projects = storage.get('projects');
        projects.forEach(project => {
            if (project.title.toLowerCase().includes(keyword) || project.desc.toLowerCase().includes(keyword)) {
                results.push({
                    name: project.title,
                    desc: project.desc.substring(0, 50) + '...',
                    type: '项目',
                    action: () => {
                        window.location.href = 'projects.html';
                        setTimeout(() => showProjectDetail(project.id), 100);
                    }
                });
            }
        });

        // 搜索内容
        contentCache.forEach(item => {
            if (item.title.toLowerCase().includes(keyword) ||
                (item.summary && item.summary.toLowerCase().includes(keyword))) {
                results.push({
                    name: item.title,
                    desc: (item.summary || '').substring(0, 50) + '...',
                    type: '内容',
                    action: () => {
                        window.location.href = 'content.html';
                        setTimeout(() => showContentDetail(item.id), 100);
                    }
                });
            }
        });

        if (results.length === 0) {
            dropdown.innerHTML = '<div class="search-no-results">没有找到相关结果</div>';
        } else {
            dropdown.innerHTML = results.map(r => `
                <div class="search-result-item" onclick="(${r.action.toString()})()">
                    <div class="result-type">${r.type}</div>
                    <div class="result-title">${escapeHtml(r.name)}</div>
                    <div class="result-desc">${escapeHtml(r.desc)}</div>
                </div>
            `).join('');
        }

        dropdown.classList.add('active');
    };
})();


