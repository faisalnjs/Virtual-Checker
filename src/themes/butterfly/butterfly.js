import "./butterfly.css";
import star0 from "./stars/star0.png";
import star1 from "./stars/star1.png";
import star2 from "./stars/star2.png";
import star3 from "./stars/star3.png";
import star4 from "./stars/star4.png";

try {
  const stars = [star0, star1, star2, star3, star4];

  setInterval(() => {
    if (document.body.getAttribute("data-theme") !== "butterfly") return;
    const w = [22, 25, 30][Math.floor(Math.random() * 3)];
    const x = Math.random() * (window.innerWidth - w);
    const starIndex = Math.floor(Math.random() * stars.length);
    const duration = 10000 * (window.innerHeight / 1000);

    const star = document.createElement("img");
    star.className = "star";
    star.src = stars[starIndex];
    star.style.width = `${w}px`;
    star.style.left = `${x}px`;
    document.body.append(star);
    star.animate(
      [
        {
          transform: "translateY(0)",
        },
        {
          transform: `translateY(${window.innerHeight + 30}px)`,
        },
      ],
      {
        duration: duration,
        easing: "linear",
      },
    );
    setTimeout(() => {
      star.remove();
    }, duration);
  }, 700);
} catch (error) {
  if (storage.get("developer")) {
    alert(`Error @ butterfly.js: ${error.message}`);
  };
  throw error;
};