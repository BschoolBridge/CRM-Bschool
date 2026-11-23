document.addEventListener("change", function (event) {
  var target = event.target;
  if (!target || target.id !== "is_superadmin") return;
  var fields = document.getElementById("permission-fields");
  if (fields) fields.style.display = target.checked ? "none" : "";
});
