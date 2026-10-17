"use strict";

const testButton = document.querySelector("#test-button");
const testStatus = document.querySelector("#test-status");
let testCount = 0;

testButton.disabled = false;
testStatus.textContent = "Prêt à tester. À vous de jouer !";

testButton.addEventListener("click", () => {
  testCount += 1;
  testStatus.classList.add("success");
  testStatus.textContent = testCount === 1
    ? "✓ JavaScript fonctionne ! Bienvenue dans l’aventure NovyNarrateur."
    : `✓ JavaScript fonctionne toujours ! Test réussi ${testCount} fois.`;
});
