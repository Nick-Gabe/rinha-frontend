// @ts-check

const jsonButton = document.getElementById("json-upload");
const main = document.querySelector("main");
const spacer = document.createElement("div");
const rootFontSize = Number(
  window.getComputedStyle(document.documentElement).fontSize.slice(0, -2)
);
const LEVEL_WIDTH = 20;
const LINE_HEIGHT = 25.5;
const BRACKET_COLORIZER_ORDER = [
  "white",
  "pink",
  "blue",
  "green",
  "purple",
  "orange",
];
let parsedJson, lastJson;
let lastRenderedLine = [];
let renderedLines = 0;
const linesPerScreen = Math.round(window.outerHeight / LINE_HEIGHT);
const baseScreenHeight = Math.floor(window.innerHeight / 100);
let maxLinesRender = linesPerScreen;
let codeDistanceFromTop = 0;
let header;

let elements = {};
let executingTimeout;

function throttle(callback, interval) {
  if (executingTimeout) return;

  executingTimeout = setTimeout(() => {
    callback();
    executingTimeout = null;
  }, interval);
}

(function createBaseElements() {
  // creates elements to be cloned later (cloning is faster than creating)
  const colon = document.createElement("span");
  colon.className = `colon`;
  colon.textContent = ": ";

  const arrayKey = document.createElement("span");
  arrayKey.className = `array key`;

  const objectKey = document.createElement("span");
  objectKey.className = `object key`;

  const stringValue = document.createElement("span");
  stringValue.className = "string";

  const literalValue = document.createElement("span");
  literalValue.className = "value";

  const property = document.createElement("p");
  property.className = "property";

  const startArrayBracket = document.createElement("span");
  startArrayBracket.className = `bracket`;
  startArrayBracket.textContent = "[";

  const startObjectBracket = startArrayBracket.cloneNode(false);
  startObjectBracket.textContent = "{";

  const endArrayBracket = document.createElement("p");
  endArrayBracket.className = `bracket`;
  endArrayBracket.textContent = "]";

  const endObjectBracket = endArrayBracket.cloneNode(false);
  endObjectBracket.textContent = "}";

  const p = document.createElement("p");

  const group = document.createElement("div");
  group.className = "group";

  elements = {
    colon,
    arrayKey,
    objectKey,
    stringValue,
    literalValue,
    property,
    startArrayBracket,
    startObjectBracket,
    endArrayBracket,
    endObjectBracket,
    group,
    p,
  };
})();

function onJsonSubmit() {
  showLoading();
  const fileUploaded = this.files[0];
  const fileReader = new FileReader();
  fileReader.readAsText(fileUploaded, "UTF-8");

  fileReader.onload = (file) => {
    try {
      if (!file.target || typeof file.target.result !== "string") return;
      parsedJson = JSON.parse(file.target.result);

      const header = document.createElement("header");

      const backButton = document.createElement("button");
      backButton.className = "back-button";
      backButton.ariaLabel = "Goes back to the original page";
      backButton.onclick = () => location.reload();

      const title = document.createElement("h1");
      title.className = "white";
      title.textContent = fileUploaded.name;

      header.append(backButton, title);

      const codeGroup = document.createElement("div");
      codeGroup.className = "group";

      if (main) {
        spacer.id = "spacer";
        codeGroup.append(spacer);
        main.innerHTML = "";
        main.append(codeGroup);
      }
      document.body.insertAdjacentElement("afterbegin", header);

      parseAndInsertJson(parsedJson, codeGroup, "object");
    } catch (error) {
      removeLoading();
      console.error(error);
      showJSONError();
    }
  };
  fileReader.onerror = () => {
    removeLoading();
  };
}

function parseAndInsertJson(
  json,
  recursiveGroup,
  groupType = "object",
  level = 0
) {
  for (const key in json) {
    if (renderedLines >= maxLinesRender) {
      return;
    }

    lastRenderedLine.length = level;
    lastRenderedLine[level] = key;
    const data = json[key];

    const existingGroup = document.getElementById(lastRenderedLine.join("-"));
    if (existingGroup) {
      parseAndInsertJson(
        data,
        existingGroup,
        existingGroup.dataset.grouptype,
        level + 1
      );
      continue;
    }

    renderedLines++;

    if (Array.isArray(data)) {
      createGroup({
        isArray: true,
        outerGroup: recursiveGroup,
        data,
        key,
        level: level + 1,
      });
      continue;
    } else if (typeof data === "object" && data !== null) {
      createGroup({
        isArray: false,
        outerGroup: recursiveGroup,
        data,
        key,
        level: level + 1,
      });
      continue;
    }
    createProperty({
      data,
      group: recursiveGroup,
      groupType,
      key,
    });
  }
}

function createGroup({ isArray, outerGroup, data, key, level }) {
  if (!outerGroup) {
    outerGroup = document.querySelector("main>.group");
  }

  const groupType = isArray ? "array" : "object";
  const content = elements.p.cloneNode(false);

  const bracketColor =
    BRACKET_COLORIZER_ORDER[level % BRACKET_COLORIZER_ORDER.length];

  const isInsideArray = outerGroup?.dataset.grouptype || false;

  const colon = elements.colon.cloneNode(true);
  const keySpan = elements[`${isInsideArray || "object"}Key`].cloneNode(false);
  keySpan.textContent = key;
  const bracket =
    elements[`start${isArray ? "Array" : "Object"}Bracket`].cloneNode(true);
  bracket.classList.add(bracketColor);
  const endBracket =
    elements[`end${isArray ? "Array" : "Object"}Bracket`].cloneNode(true);
  endBracket.classList.add(bracketColor);

  content.append(keySpan, colon, bracket);
  outerGroup.append(content);

  const newGroup = elements.group.cloneNode(false);
  newGroup.id = lastRenderedLine.join("-");
  newGroup.classList.add(bracketColor);
  newGroup.setAttribute("data-groupType", groupType);
  outerGroup.append(newGroup);

  parseAndInsertJson(data, newGroup, groupType, level);
  outerGroup.append(endBracket);
}

function createProperty({ key, groupType, data, group }) {
  deleteRenderedProps();
  const colon = elements.colon.cloneNode(true);
  const keySpan = elements[`${groupType}Key`].cloneNode(false);
  keySpan.textContent = key;

  const isString = typeof data === "string" || isNaN(Number(data));
  const value =
    elements[isString ? "stringValue" : "literalValue"].cloneNode(false);
  value.textContent = isString ? `"${data}"` : `${data}`;

  const property = elements.property.cloneNode(false);
  property.append(keySpan, colon, value);

  group.append(property);
}

function deleteRenderedProps(renderedLine = lastRenderedLine) {
  const keyPathStr = `parsedJson${renderedLine
    .map((prop) => `["${prop}"]`)
    .join("")}`;
  eval(`delete ${keyPathStr}`);
}

function showJSONError() {
  const errorParagraph = document.createElement("p");
  errorParagraph.textContent = "Invalid file. Please load a valid JSON file.";
  errorParagraph.className = "error";
  main?.insertAdjacentElement("beforeend", errorParagraph);
}

function adjustHeaderSize() {
  if (!header) header = document.querySelector("header");

  if (header && window.scrollY > 20) {
    header.className = "contracted";
    return;
  }

  header.className = "expanded";
}

function showLoading() {
  document.querySelector(".error")?.remove();
  const loadingElement = document.createElement("div");
  loadingElement.className = "loading";
  loadingElement.ariaAtomic = "true";
  loadingElement.ariaLive = "polite";
  loadingElement.role = "status";
  loadingElement.ariaLabel = "Please wait, loading...";
  loadingElement.innerHTML = `<div class="loader">
    {
    <span>.</span>
    <span>.</span>
    <span>.</span>
    }
  </div>`;

  main?.append(loadingElement);
}

function removeLoading() {
  document.querySelector(".loading")?.remove();
}

jsonButton?.addEventListener("change", onJsonSubmit);
document.addEventListener("scroll", () => {
  throttle(() => {
    adjustHeaderSize();
    if (
      window.scrollY >
      document.body.clientHeight - window.innerHeight - LINE_HEIGHT * 3
    ) {
      maxLinesRender += 50;
      parseAndInsertJson(parsedJson);
    }
  }, 100);
});
