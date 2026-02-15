const clientGrid = document.getElementById("clientGrid")
const addBtn = document.getElementById("addClientBtn")

const totalCount = document.getElementById("totalCount")
const paidCount = document.getElementById("paidCount")
const unpaidCount = document.getElementById("unpaidCount")
const expiredCount = document.getElementById("expiredCount")

const themeToggle = document.getElementById("themeToggle")

/* ---------------- LOAD CLIENTS ---------------- */

async function loadClients(){
    try{
        const res = await fetch("/clients")
        if(!res.ok) return
        const data = await res.json()
        renderClients(data)
        updateStats(data)
    }catch(err){
        console.log("Error:", err)
    }
}

/* ---------------- ADD CLIENT ---------------- */

addBtn.addEventListener("click", async () => {

    const name = document.getElementById("name").value
    const phone = document.getElementById("phone").value
    const joinDate = document.getElementById("joinDate").value
    const photo = document.getElementById("photoInput").files[0]

    if(!name || !phone || !joinDate){
        alert("Fill all fields")
        return
    }

    const formData = new FormData()
    formData.append("name", name)
    formData.append("phone", phone)
    formData.append("joinDate", joinDate)
    if(photo) formData.append("photo", photo)

    await fetch("/add-client", {
        method:"POST",
        body: formData
    })

    document.getElementById("preview").style.display = "none"

    loadClients()
})

/* ---------------- RENDER CLIENTS ---------------- */

function renderClients(clients){

    clientGrid.innerHTML = ""

    if(clients.length === 0){
        clientGrid.innerHTML = "<p style='color:white;text-align:center;'>No Clients Found</p>"
        return
    }

    clients.forEach(client => {

        const today = new Date()
       let expiry = client.expiryDate ? new Date(client.expiryDate) : null

let statusClass = ""
let badgeClass = ""
let expiryText = client.expiryDate || "Not Set"

if(!expiry){
    statusClass = "No Expiry"
    badgeClass = "badge-unpaid"
}
else if(expiry < today){
    statusClass = "Expired"
    badgeClass = "badge-expired"
}
else if(client.feeStatus === "Paid"){
    statusClass = "Paid"
    badgeClass = "badge-paid"
}
else{
    statusClass = "Unpaid"
    badgeClass = "badge-unpaid"
}


        const photoUrl = client.photo 
            ? "/uploads/" + client.photo 
            : "https://via.placeholder.com/300"

        const card = document.createElement("div")
        card.className = "client-card"

card.innerHTML = `
    <img src="${photoUrl}" class="client-img">
    <div class="client-info">
        <strong>${client.name}</strong><br>
        📞 ${client.phone}<br>
        📅 Join: ${client.joinDate}<br>
        📅 Expiry: ${expiryText}<br>

        <span class="status-badge ${badgeClass}">
            ${statusClass}
        </span>

        <div class="card-buttons">
            <button class="toggle-btn" data-id="${client._id}">
                Toggle Paid
            </button>
            <button class="renew-btn" data-id="${client._id}">
                Renew
            </button>
            <button class="delete-btn" data-id="${client._id}">
                Delete
            </button>
        </div>
    </div>
`

        clientGrid.appendChild(card)
    })

    attachButtonEvents()
}

/* ---------------- BUTTON EVENTS ---------------- */

function attachButtonEvents(){

    document.querySelectorAll(".delete-btn").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-id")

        const confirmDelete = confirm("Are you sure you want to delete?")

        if(confirmDelete){
            await fetch("/delete-client/" + id, { method:"DELETE" })
            loadClients()
        }
    })
})


    document.querySelectorAll(".toggle-btn").forEach(btn=>{
        btn.addEventListener("click", async ()=>{
            const id = btn.getAttribute("data-id")
            await fetch("/toggle-fee/" + id, { method:"PUT" })
            loadClients()
        })
    })

    document.querySelectorAll(".renew-btn").forEach(btn=>{
        btn.addEventListener("click", async ()=>{
            const id = btn.getAttribute("data-id")
            await fetch("/renew/" + id, { method:"PUT" })
            loadClients()
        })
    })
}

/* ---------------- UPDATE STATS ---------------- */

function updateStats(clients){
    totalCount.textContent = clients.length

    let paid = 0
    let unpaid = 0
    let expired = 0

    const today = new Date()

    clients.forEach(c=>{
        const expiry = new Date(c.expiryDate)

        if(expiry < today){
            expired++
        }else if(c.feeStatus === "Paid"){
            paid++
        }else{
            unpaid++
        }
    })

    paidCount.textContent = paid
    unpaidCount.textContent = unpaid
    expiredCount.textContent = expired
}

/* ---------------- CAMERA PREVIEW ---------------- */

const photoInput = document.getElementById("photoInput")
const preview = document.getElementById("preview")

photoInput.addEventListener("change", function(){
    const file = this.files[0]
    if(file){
        const reader = new FileReader()
        reader.onload = function(e){
            preview.src = e.target.result
            preview.style.display = "block"
        }
        reader.readAsDataURL(file)
    }
})

/* ---------------- DARK MODE ---------------- */

themeToggle.addEventListener("click", ()=>{
    document.body.classList.toggle("dark")
})

const logoutBtn = document.getElementById("logoutBtn")

if(logoutBtn){
  logoutBtn.addEventListener("click", async ()=>{
    await fetch("/logout")
    window.location.href = "/"
  })
}

/* ---------------- INITIAL LOAD ---------------- */

loadClients()
