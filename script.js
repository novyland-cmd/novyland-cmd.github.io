"use strict";

const currentYearElement = document.querySelector("#current-year");

if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear();
}