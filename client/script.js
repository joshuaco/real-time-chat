const getUsername = async () => {
  const username = localStorage.getItem("username");

  if (username) return username;

  const res = await fetch("https://random-data-api.com/api/users/random_user");
  const { username: randomUserName } = await res.json();

  localStorage.setItem("username", randomUserName);
  return randomUserName;
};

const socket = io({
  auth: {
    username: await getUsername(),
    serverOffset: 0,
  },
});

const $form = document.querySelector("#form");
const $input = document.querySelector("#input");
const $messages = document.querySelector("#messages");

socket.on("chat message", (msg, serverOffset, username, time) => {
  const $item = document.createElement("li");

  $item.innerHTML = `
    <p>${msg}</p>
    <small>${username}</small>
    <small>${time}</small>
  `;

  $messages.appendChild($item);
  socket.auth.serverOffset = serverOffset;

  // Scroll to bottom
  $messages.scrollTop = $messages.scrollHeight;
});

$form.addEventListener("submit", (e) => {
  e.preventDefault();

  if ($input.value) {
    socket.emit("chat message", $input.value);
    $input.value = "";
  }
});
