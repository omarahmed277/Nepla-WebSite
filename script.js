// Cart Management
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

// DOM Elements
const cartCount = document.getElementById("cart-count");
const cartToggle = document.getElementById("cart-toggle");
const cartModal = document.getElementById("cart-modal");
const closeModal = document.getElementById("close-modal");
const cartItems = document.getElementById("cart-items");
const cartTotalDisplay = document.getElementById("cart-total");
const checkoutBtn = document.getElementById("checkout-btn");
const userProfile = document.getElementById("user-profile");
const addToCartButtons = document.querySelectorAll(".add-to-cart");
const searchInput = document.getElementById("search-input");
const productItems = document.querySelectorAll(".product-item");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const checkoutLogin = document.getElementById("checkout-login");
const checkoutForm = document.getElementById("checkout-form");
const checkoutTotal = document.getElementById("checkout-total");
const paymentForm = document.getElementById("payment-form");
const logoutBtn = document.getElementById("logout-btn");

// Update User Profile
function updateUserProfile() {
  const user = JSON.parse(localStorage.getItem("user"));
  if (user && userProfile) {
    userProfile.style.display = "inline";
    userProfile.textContent = `Hi, ${user.username}`;
  } else if (userProfile) {
    userProfile.style.display = "none";
  }
}

// Update Cart
function updateCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
  if (cartCount) cartCount.textContent = cart.length;
  if (cartItems) {
    cartItems.innerHTML = "";
    cart.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = `${item.name} - $${item.price}`;
      cartItems.appendChild(li);
    });
  }
  if (cartTotalDisplay) cartTotalDisplay.textContent = cartTotal.toFixed(2);
  if (checkoutTotal) checkoutTotal.textContent = cartTotal.toFixed(2);
}

// Cart Functionality
if (addToCartButtons.length > 0) {
  addToCartButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.getAttribute("data-name");
      const price = parseFloat(button.getAttribute("data-price"));
      cart.push({ name, price });
      cartTotal += price;
      updateCart();
      alert(`${name} added to cart!`);
    });
  });
}

// Cart Modal
if (cartToggle && cartModal) {
  cartToggle.addEventListener("click", (e) => {
    e.preventDefault();
    cartModal.style.display = "block";
    updateCart();
  });
}

if (closeModal && cartModal) {
  closeModal.addEventListener("click", () => {
    cartModal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target === cartModal) {
      cartModal.style.display = "none";
    }
  });
}

if (checkoutBtn) {
  checkoutBtn.addEventListener("click", () => {
    cartModal.style.display = "none";
    window.location.href = "checkout.html";
  });
}

// Product Search
if (searchInput) {
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();
    productItems.forEach((item) => {
      const name = item.getAttribute("data-name").toLowerCase();
      item.style.display = name.includes(query) ? "block" : "none";
    });
  });
}

// Login Functionality
if (loginForm) {
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const emailError = document.getElementById("email-error");
  const passwordError = document.getElementById("password-error");

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    const storedUser = JSON.parse(localStorage.getItem("user"));

    emailError.style.display = "none";
    passwordError.style.display = "none";

    if (!email.includes("@")) {
      emailError.style.display = "block";
      return;
    }
    if (
      !storedUser ||
      storedUser.email !== email ||
      storedUser.password !== password
    ) {
      passwordError.style.display = "block";
      return;
    }

    alert("Login successful!");
    window.location.href = "shop.html";
  });
}

// Signup Functionality
if (signupForm) {
  const usernameInput = document.getElementById("username");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const usernameError = document.getElementById("username-error");
  const emailError = document.getElementById("email-error");
  const passwordError = document.getElementById("password-error");

  signupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = usernameInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;

    usernameError.style.display = "none";
    emailError.style.display = "none";
    passwordError.style.display = "none";

    if (username.length < 3) {
      usernameError.style.display = "block";
      return;
    }
    if (!email.includes("@")) {
      emailError.style.display = "block";
      return;
    }
    if (password.length < 6) {
      passwordError.style.display = "block";
      return;
    }

    const user = { username, email, password };
    localStorage.setItem("user", JSON.stringify(user));
    alert("Signup successful! Please login.");
    window.location.href = "login.html";
  });
}

// Checkout Logic
if (checkoutLogin && checkoutForm) {
  const user = JSON.parse(localStorage.getItem("user"));
  if (user) {
    checkoutForm.style.display = "block";
    checkoutLogin.style.display = "none";
  } else {
    checkoutForm.style.display = "none";
    checkoutLogin.style.display = "block";
  }
}

if (paymentForm) {
  paymentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert("Your cart is empty!");
      return;
    }
    alert("Purchase completed! (Demo)");
    cart = [];
    cartTotal = 0;
    localStorage.setItem("cart", JSON.stringify(cart));
    window.location.href = "shop.html";
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("user");
    updateUserProfile();
    window.location.href = "index.html";
  });
}

// Initialize
updateUserProfile();
updateCart();
