document.addEventListener("DOMContentLoaded", () => {
	const container = document.querySelector(".container");
	const blobs = document.querySelector(".blobs");
	const switchButtons = document.querySelectorAll(".switch-button");

	switchButtons.forEach((button) => {
		button.append(blobs.cloneNode(true));
		button.addEventListener("click", () => {
			console.log(button);
			container.classList = `container palette-${button.dataset.palette}`;
		});
	});
});
