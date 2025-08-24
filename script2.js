// === AUDIO ===
let Music = document.getElementById('myAudio');
let playButton = document.getElementById('playButton');

function playPause() {
  Music.play();
}

// Toggle Button
let line1 = document.querySelector('.line1');
let line2 = document.querySelector('.line2');
let line3 = document.querySelector('.line3');
let line4 = document.querySelector('.line4');
let line5 = document.querySelector('.line5');
let play = document.querySelector('.play');
let pause = document.querySelector('.pause');

// Pause circle animations
let circle = document.querySelector('.circle');
let circle2 = document.querySelector('.circle2');

document.querySelector('.play').onclick = function () {
  this.classList.toggle('active');
  line1.classList.toggle('active');
  line2.classList.toggle('active');
  line3.classList.toggle('active');
  line4.classList.toggle('active');
  line5.classList.toggle('active');
  pause.classList.toggle('active');
  circle.classList.toggle('active');
  circle2.classList.toggle('active');

  if (play.classList.contains('active')) {
    playPause();
  } else {
    Music.pause();
  }
};

// === LỜI NHẮN + POPUP ===
const messages = [
  "🌟 Sáng hay trưa hay chiều hay tối gì đó chúc bà zui zẻ nho:))",
  "💫 Hôm nay tui có vài điều muốn nói tí...",
  "🌌 chúc bà hôm nay có những điều tuyệt đẹp đến với đời hơn nữa ><",
  "✨ Mãi 2 chữ: YÊU CẬU "
];

const palettes = [
  ["#ff9a9e", "#fad0c4"], // peachy
  ["#a1c4fd", "#c2e9fb"], // baby blue
  ["#fbc2eb", "#a6c1ee"], // pink-lavender
  ["#84fab0", "#8fd3f4"]  // mint-cyan
];

const wrap = document.getElementById("star-wrap");
const btn  = document.getElementById("starBtn");
const startBtn = document.getElementById("startGameBtn");

let idx = 0;
let locked = false;

btn.addEventListener("pointermove", (e) => {
  const r = btn.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 100;
  const y = ((e.clientY - r.top)  / r.height) * 100;
  btn.style.setProperty("--mx", `${x}%`);
  btn.style.setProperty("--my", `${y}%`);
});

btn.addEventListener("click", () => {
  if (locked) return;
  locked = true;
  btn.disabled = true;

  // Nội dung + màu
  const text = messages[idx];
  const [g1, g2] = palettes[idx % palettes.length];

  btn.style.setProperty("--g1", g1);
  btn.style.setProperty("--g2", g2);

  // Popup
  const pop = document.createElement("div");
  pop.className = "popup";
  pop.textContent = text;
  pop.style.background = `linear-gradient(135deg, ${g1}, ${g2})`;
  wrap.appendChild(pop);

  // Sau animation thì remove
  const unlock = () => { pop.remove(); locked = false; btn.disabled = false; };
  pop.addEventListener("animationend", unlock, { once: true });
  setTimeout(() => { if (locked) unlock(); }, 3200);

  // Qua message tiếp theo
  idx++;

  // Khi hết message → hiện nút Start
  if (idx >= messages.length) {
    btn.style.display = "none";          // ẩn nút Star
    setTimeout(() => {
      startBtn.style.display = "inline-block"; // show nút Start
    }, 800); // delay tí cho mượt
  }
});




// === FLOW: STAR → MESSAGE → START → LOADING → GO ===
document.addEventListener('DOMContentLoaded', () => {
  const loadingScreen = document.getElementById("loading");   // overlay loading
  const loadingText = loadingScreen ? loadingScreen.querySelector(".loading-text") : null;
  const starBtn = document.getElementById("starBtn");         // nút ⭐
  const startGameBtn = document.getElementById("startGameBtn"); // nút 🚀 Start

  // Khởi tạo
  if (loadingScreen) loadingScreen.style.display = 'none';
  startGameBtn.style.display = 'none';   // Start ẩn ban đầu
  starBtn.style.display = 'inline-block'; // Star xuất hiện trước

  // Các đoạn text theo từng mốc
  const texts = [
    "nhìn 1 tí chứ nhỉ U-u",
    "trên những ngôi sao băng",
    "sẽ có thứ cậu cần",
    "vào thôi nào"
  ];

  // Bấm Start => show loading + chạy text sequence + redirect
  startGameBtn.addEventListener('click', () => {
    startGameBtn.disabled = true;
    startGameBtn.style.display = 'none';
    if (loadingScreen) loadingScreen.style.display = 'flex';

    if (loadingText) {
      let i = 0;
      loadingText.textContent = texts[i];
      const interval = setInterval(() => {
        i++;
        if (i < texts.length) {
          loadingText.textContent = texts[i];
        } else {
          clearInterval(interval);
        }
      }, 2000);
    }

    // Sau 7s thì chuyển trang
    setTimeout(() => {
      window.location.href = "yan/index.html";
    }, 7000);
  });
});

