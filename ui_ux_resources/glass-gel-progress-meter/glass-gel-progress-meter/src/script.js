
const q$ = document.querySelector.bind(document);
const q$a = document.querySelectorAll.bind(document);


/* handle style changes */
const $radios = q$a('.group.style input');
const $progresses = q$a('progress');
$radios.forEach($el => {
    $el.addEventListener('change', (ev) => {
        updateStyle();
    });
});
const updateStyle = () => {
    const $checked =  q$('.group.style :checked');
    const style = $checked.id;
    $progresses.forEach(($el) => $el.setAttribute('data-style', style));
}
const randomColor = Math.floor(Math.random() * $radios.length); 
$radios[randomColor].checked = true;
updateStyle();


/* handle range values */
const $size = q$('#progress-size');
const $value = q$('#progress-value');

$size.addEventListener('input', (ev) => {
    const v = $size.value;
    $progresses.forEach(($el) => $el.parentElement.style.setProperty('--size', v + 'em'));
});

$value.addEventListener('input', (ev) => {
    const v = $value.value;
    $progresses[1].value = v;
    $progresses[1].innerText = `${v}%`;
    $progresses[1].previousElementSibling.innerText = `Progress: ${v}%`;
});


/* handle animation direction */
const $dir = q$('[for=loading] em');
const $app = q$('#app');
let dir = 1;
$dir.addEventListener('click', (ev) => {
    switch( dir ) {
        case 1:
            $dir.innerText = '(reverse)';
            $progresses[0].toggleAttribute('data-reverse', true);
            $app.toggleAttribute('data-reverse', true); /* chrome hack */
            dir = 2;
            break;
        case 2:
            $dir.innerText = '(alternate)';
            $progresses[0].toggleAttribute('data-alternate', true);
            $app.toggleAttribute('data-alternate', true); /* chrome hack */
            dir = 3;
            break;
        case 3:
            $dir.innerText = '(indeterminate)';
            $progresses[0].toggleAttribute('data-reverse', false);
            $progresses[0].toggleAttribute('data-alternate', false);
            $app.toggleAttribute('data-reverse', false); /* chrome hack */
            $app.toggleAttribute('data-alternate', false); /* chrome hack */
            dir = 1;
            break;
    }
});












/* handle theme toggle */

const prefersDarkMode = false;
const $themeToggle = document.querySelector('#theme-toggle');
$themeToggle.checked = prefersDarkMode;
const setTheme = () => {
    document.body.classList.add('themed');
    document.body.toggleAttribute('is-dark', $themeToggle.checked);
}
$themeToggle.addEventListener('change', setTheme);
setTheme();