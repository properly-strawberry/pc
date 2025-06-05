import "./pengos.js";

(function () {
  function create(name) {
    let content;
    let template = document.querySelector('template[name="' + name + '"]');

    if (template) {
      content = template.content.cloneNode(true /* deep clone */);

      if (template.hasAttribute("rooted")) {
        content = content.firstElementChild;
      }

      let boundTags = content.querySelectorAll("[id]");
      for (let tag of boundTags) {
        content[tag.id] = tag;
        tag.removeAttribute("id");
      }
    } else {
      content = document.createElement(name);
    }

    return content;
  }

  async function onKey(event) {
    if (inChildProcess) {
      return;
    }

    let modifier = event.altKey || event.ctrlKey;
    let input = prompt.input;

    console.log(event.code);

    if (event.code == "Backspace") {
      input.innerText = input.innerText.substring(
        0,
        input.innerText.length - 1
      );
    } else if (event.code == "Enter" || event.code == "NumpadEnter") {
      if (prompt !== null) {
        prompt.removeChild(prompt.cursor);
      }

      let response = addResponse();
      inChildProcess = true;
      await submit(input.innerText, function (text) {
        response.innerText += text + "\n";
        scroll();
      });

      // Hack to deal with the order in which events happen.
      //
      // The purpose of the inChildProcess flag is so that the main "shell loop" (this function) does not
      // process key events while a "child process" (a command the user runs in the shell) is running,
      // since those key events are for the child. So we set inChildProcess = true before running a comand,
      // and then unset it when the command returns.
      //
      // The problem is that if a command is terminated by a keypress ("Press Any Key To Continue..."),
      // then the order of events is (1) the command exits, (2) the statement below runs, (3) the key event
      // reaches this listener. So the flag will have already been unset by the time it's needed, in that
      // case. The setTimeout() with 0 duration thing is just a trick to tell JavaScript to run the event
      // loop around again at least once before executing a piece of code.
      //
      // (event.preventDefault() did not seem to help)
      //
      setTimeout(() => {
        inChildProcess = false;
      }, 0);

      addPrompt();
    } else if (event.code == "Tab") {
      let completion = tab(input.innerText);
      input.innerText += completion;

      event.preventDefault();
    } else if (event.key.length == 1 && !modifier) {
      input.innerText += event.key;

      event.preventDefault();
    }

    scroll();
  }

  function scroll() {
    let offset =
      screenContents.clientHeight -
      (document.getElementById("screen").clientHeight - 40);

    if (offset > 0) {
      screenContents.style.top = "-" + offset + "px";
    }
  }

  function addResponse() {
    let response = create("p");
    screenContents.appendChild(response);
    return response;
  }

  function addPrompt() {
    prompt = create("prompt");
    screenContents.appendChild(prompt);
  }

  let inChildProcess = false;

  let prompt = null;

  {
    let response = addResponse();
    response.innerText = startup();
  }
  addPrompt();

  addEventListener("keydown", onKey);

  startupNoise.volume = 0.7;
  startupNoise.play();
})();
