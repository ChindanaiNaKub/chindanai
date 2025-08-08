(function(){
  "use strict";

  const terminalElement = document.getElementById("terminal");
  const historyElement = document.getElementById("history");
  const inputElement = document.getElementById("cmd");
  const suggestionElement = document.getElementById("suggestion");
  const promptText = "guest@portfolio:~$";
  const rootElement = document.documentElement;
  const bgCanvas = document.getElementById("bg");
  const bgCtx = bgCanvas && bgCanvas.getContext ? bgCanvas.getContext("2d") : null;

  // Background state
  let rafHandle = 0;
  let lastTime = 0;
  let particles = [];
  let matrixCols = [];
  let wavesPhase = 0;

  /**
   * Replace these with your real data.
   */
  const PROFILE = {
    name: "Chindanai Jaiman",
    nickname: "prab",
    role: "Software Engineering Student (3rd year)",
    location: "Chiang Mai, Thailand",
    email: "chindanai_jaiman@cmu.ac.th",
    website: "https://bettermango.vercel.app/",
    github: "https://github.com/ChindanaiNaKub",
    linkedin: "",
    lineId: "prabcj",
  };

  const HELP_TEXT = [
    "Available commands:",
    "  help            - Show this help",
    "  whoami          - Show your name and role",
    "  about           - A short bio",
    "  skills          - Key technologies",
    "  projects        - Selected projects",
    "  experience      - Work history (brief)",
    "  education       - Education (brief)",
    "  contact         - How to reach me",
    "  clear           - Clear the screen",
    "  ls, cd, cat     - Explore a simulated filesystem",
    "  open <link>     - Open external links",
    "  theme <name>    - Switch theme (dark, light, matrix)",
    "  typewriter      - Toggle typewriter output",
    "  bg <mode>       - Background: off, particles, matrix, waves",
  ];

  const cmdHistory = JSON.parse(localStorage.getItem("term.history") || "[]");
  let historyIndex = cmdHistory.length;
  let typewriterEnabled = JSON.parse(localStorage.getItem("term.typewriter") || "false");
  let showBanner = JSON.parse(localStorage.getItem("term.banner") || "true");
  const savedBg = localStorage.getItem("term.bg");
  let bgMode = savedBg ? JSON.parse(savedBg) : "waves";
  if(!savedBg){
    localStorage.setItem("term.bg", JSON.stringify(bgMode));
  }
  const fsState = {
    path: ["~"],
  };
  const FILESYSTEM = {
    "~": {
      type: "dir",
      children: {
        about: { type: "file", content: "Hi, I'm ${name} (${nickname}). I'm a 3rd-year Software Engineering student at Chiang Mai University. I like using AI tools to prepare before coding and to learn faster." },
        projects: { type: "dir", children: {
          bettermango: { type: "file", content: "BetterMango — alternative to CMU Mango using AI. https://bettermango.vercel.app/" },
          huaythai: { type: "file", content: "HuayThai — Thai lottery data (35 years) with AI chat. https://www.huaythai.store/" },
          aigenfootball: { type: "file", content: "AI Gen Football — AI chatbot using Gemini (currently broken). https://aigenfootball.vercel.app/" },
        }},
        contact: { type: "file", content: "Email: ${email}\nGitHub: ${github}\nLine: ${lineId}" },
      }
    }
  };

  function focusInput(){ inputElement.focus(); }

  function appendLine(text, cssClass){
    const line = document.createElement("div");
    line.className = `line ${cssClass || ""}`.trim();
    line.textContent = text;
    historyElement.appendChild(line);
  }

  async function appendOutput(lines){
    if(Array.isArray(lines)){
      for(const l of lines){ await appendOutput(l); }
      return;
    }
    if(lines == null){ return; }

    if(typeof lines === "string"){
      if(typewriterEnabled){
        await typeText(lines);
      } else {
        const out = document.createElement("div");
        out.className = "output";
        out.textContent = lines;
        historyElement.appendChild(out);
      }
      return;
    }
    if(lines instanceof Node){
      const out = document.createElement("div");
      out.className = "output";
      out.appendChild(lines);
      historyElement.appendChild(out);
    }
  }

  function scrollToBottom(){
    terminalElement.scrollTop = terminalElement.scrollHeight;
  }

  function printPromptWithCommand(command){
    const wrap = document.createElement("div");
    wrap.className = "line line--input";

    const prompt = document.createElement("span");
    prompt.className = "prompt";
    prompt.textContent = promptText.replace(":~$", ":~$");

    const cmd = document.createElement("span");
    cmd.textContent = command;

    wrap.appendChild(prompt);
    wrap.appendChild(cmd);
    historyElement.appendChild(wrap);
  }

  async function handleCommand(raw){
    const command = (raw || "").trim();
    if(!command){ return; }

    printPromptWithCommand(command);

    const [name, ...args] = command.split(/\s+/);
    const argString = args.join(" ");

    // Resolve command by exact match, otherwise by unique prefix (e.g., "ab" -> "about")
    let handler = COMMANDS[name];
    let resolvedName = name;

    if(!handler && name){
      const commandsList = Object.keys(COMMANDS);
      const prefixMatches = commandsList.filter(commandName => commandName.startsWith(name));
      if(prefixMatches.length === 1){
        resolvedName = prefixMatches[0];
        handler = COMMANDS[resolvedName];
      } else if(prefixMatches.length > 1){
        await appendOutput(`Ambiguous command "${name}". Did you mean: ${prefixMatches.join(", ")}?`);
        scrollToBottom();
        return;
      }
    }

    if(handler){
      const result = await handler(argString, args);
      if(result !== undefined){ await appendOutput(result); }
    } else {
      await appendOutput(`Command not found: ${name}. Type 'help' to list commands.`);
    }

    scrollToBottom();
  }

  function getCwd(){ return fsState.path[fsState.path.length - 1]; }

  function resolvePath(input){
    if(!input || input === ".") return fsState.path;
    if(input === "~") return ["~"]; 
    const parts = input.split("/");
    let current = input.startsWith("/") ? ["~"] : [...fsState.path];
    for(const part of parts){
      if(!part || part === ".") continue;
      if(part === ".."){
        if(current.length > 1) current.pop();
        continue;
      }
      const dir = getNode(current);
      if(!dir || dir.type !== "dir" || !dir.children[part]) return null;
      current.push(part);
    }
    return current;
  }

  function getNode(pathArr){
    let node = FILESYSTEM["~"]; // root
    for(let i=1;i<pathArr.length;i++){
      const seg = pathArr[i];
      if(node.type !== "dir" || !node.children[seg]) return null;
      node = node.children[seg];
    }
    return node;
  }

  const COMMANDS = {
    async help(){ return HELP_TEXT; },

    whoami(){
      return `${PROFILE.name} — ${PROFILE.role} (${PROFILE.location})`;
    },

    async about(){
      return [
        `${PROFILE.name} (${PROFILE.nickname}) is a ${PROFILE.role} at Chiang Mai University, based in ${PROFILE.location}.`,
        "Enjoys using AI tools to prepare before coding and to learn faster.",
      ];
    },

    async skills(){
      return [
        "Languages: HTML, CSS, JavaScript, TypeScript, C#, Python, SQL",
        "Tools/Platforms: Docker, GitHub CI/CD, Supabase, Vercel, Resend, OpenRouter",
        "Interests: AI-assisted development",
      ];
    },

    async projects(){
      const frag = document.createDocumentFragment();
      const lines = [
        ["BetterMango", "https://bettermango.vercel.app/", "bettermango.vercel.app"],
        ["HuayThai", "https://www.huaythai.store/", "huaythai.store"],
        ["AI Gen Football", "https://aigenfootball.vercel.app/", "aigenfootball.vercel.app"],
        ["GitHub (more)", "https://github.com/ChindanaiNaKub", "github.com/ChindanaiNaKub"],
      ];
      for(const [label, href, text] of lines){
        const line = document.createElement("div");
        line.className = "output";
        const strong = document.createElement("strong");
        strong.textContent = label + ": ";
        const a = document.createElement("a");
        a.href = href; a.target = "_blank"; a.rel = "noopener"; a.textContent = text;
        line.appendChild(strong);
        line.appendChild(a);
        frag.appendChild(line);
      }
      return frag;
    },

    async experience(){
      return [
        "No formal work experience yet — actively building projects on GitHub.",
      ];
    },

    async education(){
      return [
        "Bangkok Christain College — Primary",
        "Bunyawat Witthayalai School — High School",
        "Chiang Mai University — Software Engineering (3rd year)",
      ];
    },

    async contact(){
      const frag = document.createDocumentFragment();

      const lines = [
        ["Email", `mailto:${PROFILE.email}`, PROFILE.email],
        ["GitHub", PROFILE.github, PROFILE.github],
        ["Line", `https://line.me/R/ti/p/~${PROFILE.lineId}` , PROFILE.lineId],
      ];

      for(const [label, href, text] of lines){
        const line = document.createElement("div");
        line.className = "output";
        const strong = document.createElement("strong");
        strong.textContent = label + ": ";
        const a = document.createElement("a");
        a.href = href; a.target = "_blank"; a.rel = "noopener"; a.textContent = text;
        line.appendChild(strong);
        line.appendChild(a);
        frag.appendChild(line);
      }

      return frag;
    },


    async clear(){
      historyElement.innerHTML = "";
      return undefined;
    },

    // Filesystem commands
    async ls(){
      const node = getNode(fsState.path);
      if(!node || node.type !== "dir") return;
      const entries = Object.keys(node.children);
      return entries.join("  ");
    },
    async cd(arg){
      const to = (arg || "").trim();
      const resolved = resolvePath(to || "~");
      if(!resolved){ return `cd: no such file or directory: ${to}`; }
      const node = getNode(resolved);
      if(!node || node.type !== "dir") return `cd: not a directory: ${to}`;
      fsState.path = resolved;
      updatePromptPath();
      return undefined;
    },
    async cat(arg){
      const to = (arg || "").trim();
      const resolved = resolvePath(to);
      if(!resolved) return `cat: ${to}: No such file`;
      const node = getNode(resolved);
      if(!node) return `cat: ${to}: No such file`;
      if(node.type === "dir") return `cat: ${to}: Is a directory`;
      // interpolate PROFILE fields
      const content = node.content
        .replaceAll("${name}", PROFILE.name)
        .replaceAll("${nickname}", PROFILE.nickname || "")
        .replaceAll("${email}", PROFILE.email)
        .replaceAll("${github}", PROFILE.github)
        .replaceAll("${linkedin}", PROFILE.linkedin || "")
        .replaceAll("${website}", PROFILE.website || "")
        .replaceAll("${lineId}", PROFILE.lineId || "");
      return content;
    },
    async open(arg){
      const url = (arg || "").trim();
      if(!url) return "open: provide a URL";
      const a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.rel = "noopener"; a.click();
      return `Opened ${url}`;
    },

    // Theme and toggles
    async theme(arg){
      const name = (arg || "").trim() || "dark";
      if(!["dark","light","matrix"].includes(name)){
        return "theme: options are dark, light, matrix";
      }
      rootElement.setAttribute("data-theme", name);
      localStorage.setItem("term.theme", JSON.stringify(name));
      return `Theme set to ${name}`;
    },
    async banner(){
      showBanner = !showBanner;
      localStorage.setItem("term.banner", JSON.stringify(showBanner));
      return showBanner ? "Banner enabled" : "Banner disabled";
    },
    async typewriter(){
      typewriterEnabled = !typewriterEnabled;
      localStorage.setItem("term.typewriter", JSON.stringify(typewriterEnabled));
      return `Typewriter ${typewriterEnabled ? "enabled" : "disabled"}`;
    },
    async bg(arg){
      const mode = (arg || "").trim() || "off";
      if(!["off","particles","matrix","waves"].includes(mode)){
        return "bg: options are off, particles, matrix, waves";
      }
      bgMode = mode;
      localStorage.setItem("term.bg", JSON.stringify(bgMode));
      startBackground();
      return `Background set to ${mode}`;
    },
  };

  // Wire up interactions
  document.addEventListener("keydown", (e)=>{
    if(e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey){
      // Quick focus shortcut: press '/' anywhere
      focusInput();
    }
  });

  terminalElement.addEventListener("click", focusInput);

  inputElement.addEventListener("keydown", (e)=>{
    if(e.key === "Enter"){
      const value = inputElement.value;
      cmdHistory.push(value);
      localStorage.setItem("term.history", JSON.stringify(cmdHistory));
      historyIndex = cmdHistory.length;
      inputElement.value = "";
      if(suggestionElement){ suggestionElement.textContent = ""; }
      handleCommand(value);
      e.preventDefault();
      return;
    }

    if(e.key === "ArrowUp"){
      if(cmdHistory.length === 0) return;
      historyIndex = Math.max(0, historyIndex - 1);
      inputElement.value = cmdHistory[historyIndex] || "";
      e.preventDefault();
    } else if(e.key === "ArrowDown"){
      if(cmdHistory.length === 0) return;
      historyIndex = Math.min(cmdHistory.length, historyIndex + 1);
      inputElement.value = cmdHistory[historyIndex] || "";
      e.preventDefault();
    } else if(e.key === "Tab"){
      // Autocomplete
      const current = inputElement.value;
      const [name, ...rest] = current.split(/\s+/);
      const partial = name || "";
      const cmds = Object.keys(COMMANDS);
      const matches = cmds.filter(c => c.startsWith(partial));
      if(matches.length === 1){
        const completed = matches[0] + (rest.length ? " " + rest.join(" ") : " ");
        inputElement.value = completed;
        if(suggestionElement){ suggestionElement.textContent = ""; }
      }
      e.preventDefault();
    }
  });

  // Live suggestion: show unique autocomplete match in muted text
  inputElement.addEventListener("input", ()=>{
    if(!suggestionElement) return;
    const current = inputElement.value;
    const [name] = current.split(/\s+/);
    const partial = name || "";
    if(!partial){ suggestionElement.textContent = ""; return; }
    const cmds = Object.keys(COMMANDS);
    const matches = cmds.filter(c => c.startsWith(partial));
    if(matches.length === 1 && matches[0] !== partial){
      suggestionElement.textContent = matches[0];
    } else {
      suggestionElement.textContent = "";
    }
  });

  function updatePromptPath(){
    const pathSpan = document.querySelector(".prompt .path");
    if(pathSpan){
      pathSpan.textContent = fsState.path.join("/");
    }
  }

  function renderBanner(){}

  async function typeText(text){
    const out = document.createElement("div");
    out.className = "output";
    historyElement.appendChild(out);
    for(const ch of text){
      out.textContent += ch;
      await new Promise(r=>setTimeout(r, 8));
    }
  }

  // Initialize theme
  const savedTheme = JSON.parse(localStorage.getItem("term.theme") || '"dark"');
  document.documentElement.setAttribute("data-theme", savedTheme);

  // Initialize background
  startBackground();

  // Initial message
  appendLine(promptText + " welcome!", "output--muted");
  renderBanner();
  appendOutput([`Welcome to ${PROFILE.name}'s terminal portfolio.`, "Type 'help' to see available commands."]);
  scrollToBottom();

  // Autofocus on load
  setTimeout(focusInput, 50);

  // ===== Background helpers =====
  function sizeCanvas(){
    if(!bgCanvas || !bgCtx) return;
    const dpr = window.devicePixelRatio || 1;
    // Use viewport size
    const width = window.innerWidth;
    const height = window.innerHeight;
    bgCanvas.width = Math.round(width * dpr);
    bgCanvas.height = Math.round(height * dpr);
    bgCanvas.style.width = width + "px";
    bgCanvas.style.height = height + "px";
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clearBg(){
    if(!bgCtx) return;
    const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#0b0f10';
    bgCtx.fillStyle = bg;
    bgCtx.fillRect(0,0,bgCanvas.width, bgCanvas.height);
  }

  function startBackground(){
    if(!bgCanvas || !bgCtx) return;
    cancelAnimationFrame(rafHandle);
    sizeCanvas();
    setupMode();
    lastTime = performance.now();
    rafHandle = requestAnimationFrame(loop);
  }

  function setupMode(){
    const width = bgCanvas.width;
    const height = bgCanvas.height;
    if(bgMode === 'particles'){
      particles = Array.from({length: 70}, ()=>({
        x: Math.random()*width,
        y: Math.random()*height,
        vx: (Math.random()*2-1)*0.3,
        vy: (Math.random()*2-1)*0.3,
        r: Math.random()*2+0.5,
      }));
    } else if(bgMode === 'matrix'){
      const colWidth = 12;
      const cols = Math.ceil(width / colWidth);
      matrixCols = Array.from({length: cols}, ()=>({
        y: Math.random()*-height,
        speed: 50 + Math.random()*120,
      }));
    } else if(bgMode === 'waves'){
      wavesPhase = 0;
    }
  }

  function loop(ts){
    const dt = (ts - lastTime) / 1000;
    lastTime = ts;
    render(dt);
    rafHandle = requestAnimationFrame(loop);
  }

  function render(dt){
    if(bgMode === 'off'){ clearBg(); return; }
    clearBg();
    const style = getComputedStyle(document.body);
    const accent = style.getPropertyValue('--accent').trim() || '#9cff57';
    const muted = style.getPropertyValue('--muted').trim() || '#9fb4b0';
    const width = bgCanvas.width;
    const height = bgCanvas.height;

    if(bgMode === 'particles'){
      for(const p of particles){
        p.x += p.vx * (dt*60);
        p.y += p.vy * (dt*60);
        if(p.x < 0 || p.x > width) p.vx *= -1;
        if(p.y < 0 || p.y > height) p.vy *= -1;
      }
      bgCtx.strokeStyle = hexToRgba(accent, 0.25);
      bgCtx.lineWidth = 1;
      for(let i=0;i<particles.length;i++){
        for(let j=i+1;j<particles.length;j++){
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x; const dy = a.y - b.y;
          const d2 = dx*dx + dy*dy;
          if(d2 < 130*130){
            const alpha = Math.max(0, 1 - d2/(130*130));
            bgCtx.strokeStyle = hexToRgba(accent, 0.15 + 0.25*alpha);
            bgCtx.beginPath();
            bgCtx.moveTo(a.x, a.y);
            bgCtx.lineTo(b.x, b.y);
            bgCtx.stroke();
          }
        }
      }
      bgCtx.fillStyle = hexToRgba(accent, 0.9);
      for(const p of particles){
        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        bgCtx.fill();
      }
    } else if(bgMode === 'matrix'){
      const colWidth = 12;
      const rows = Math.ceil(height / 14);
      bgCtx.fillStyle = hexToRgba(accent, 0.08);
      bgCtx.fillRect(0,0,width,height);
      bgCtx.fillStyle = accent;
      bgCtx.font = '14px ui-monospace, monospace';
      for(let i=0;i<matrixCols.length;i++){
        const col = matrixCols[i];
        col.y += col.speed * dt;
        if(col.y > height + 50){
          col.y = Math.random()*-height;
          col.speed = 50 + Math.random()*120;
        }
        for(let r=0;r<rows;r++){
          const y = Math.floor(col.y - r*14);
          if(y < -14 || y > height+14) continue;
          const ch = String.fromCharCode(0x30A0 + Math.floor(Math.random()*96));
          bgCtx.fillText(ch, i*colWidth, y);
        }
      }
    } else if(bgMode === 'waves'){
      wavesPhase += dt;
      bgCtx.strokeStyle = hexToRgba(accent, 0.6);
      bgCtx.lineWidth = 2;
      const lines = 4;
      for(let l=0;l<lines;l++){
        const yBase = height*(0.3 + 0.15*l/lines);
        bgCtx.beginPath();
        for(let x=0;x<=width;x+=6){
          const y = yBase + Math.sin((x*0.012)+(wavesPhase*2 + l))*12 + Math.cos((x*0.02)-(wavesPhase*1.7))*6;
          if(x===0) bgCtx.moveTo(x,y); else bgCtx.lineTo(x,y);
        }
        bgCtx.stroke();
      }
    }
  }

  function hexToRgba(hex, alpha){
    const c = hex.replace('#','');
    const r = parseInt(c.slice(0,2),16);
    const g = parseInt(c.slice(2,4),16);
    const b = parseInt(c.slice(4,6),16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  window.addEventListener('resize', ()=>{
    sizeCanvas();
    setupMode();
  });
})();
