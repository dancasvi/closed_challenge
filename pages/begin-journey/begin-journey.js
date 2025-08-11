$(document).ready(function() {
    // Initialize the page with any necessary setup
    console.log("Begin Journey page is ready.");
    debugger;
    const accountInfo = getAccountInfo();

    if(accountInfo) {
        showMap();
    }

    function getAccountInfo() {
        let account = localStorage.getItem('closed_challenge_account');
        localStorage.setItem('bag_info', JSON.stringify({ pokeball: 10, potion: 10 }));
        let bagInfo = localStorage.getItem('bag_info');


        account = account ? JSON.parse(account) : null;
        bagInfo = bagInfo ? JSON.parse(bagInfo) : null;

        let character = {};

        if(account) {
            character = {
                account: account
            };

            if(bagInfo) {
                character.bag = bagInfo;
            }
        }

        return character;
    }

    function showMap() {
        window.location.href = `../../config/map/route/route-view.html`;
    }
});