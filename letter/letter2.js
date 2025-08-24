const wrapper = document.querySelector('.envelope-wrapper');
const heart   = document.querySelector('.heart');
heart.addEventListener('click', () => wrapper.classList.toggle('open'));
