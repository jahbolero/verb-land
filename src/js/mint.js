import { createApp } from "vue/dist/vue.esm-bundler";
const Web3 = require("web3");
const jquery = require("jquery");
const toastr = require("toastr");
const ABI = require("../files/ABI.json");
const presaleAddresses = require("../files/presaleAddresses.json");
const freesaleAddresses = require("../files/freesaleAddresses.json");
const MerkleTree = require("merkletreejs").default;
const ethers = require("ethers");
const keccak256 = require("keccak256");

import WalletConnectProvider from "@walletconnect/web3-provider";

import Web3Modal from "web3modal";

const providerOptions = {
  walletconnect: {
    package: WalletConnectProvider, // required
    options: {
      infuraId: "7edb90d1cdcb40f48c38c17568b5ea78", // required
    },
  },
};

const web3Modal = new Web3Modal({
  network: "mainnet", // optional
  cacheProvider: true, // optional
  providerOptions, // required
});

toastr.options = {
  closeButton: false,
  debug: false,
  newestOnTop: false,
  progressBar: false,
  positionClass: "toast-top-right",
  preventDuplicates: false,
  onclick: null,
  showDuration: "300",
  hideDuration: "1000",
  timeOut: "5000",
  extendedTimeOut: "1000",
  showEasing: "swing",
  hideEasing: "linear",
  showMethod: "fadeIn",
  hideMethod: "fadeOut",
};
const app = createApp({
  el: "#vue-app",
  data() {
    return {
      //Constants
      account: null,
      contractAddress: "0x390868F5fE8e2fA95a9b1C37f4E55E5dDF4DB5Ba",
      nftContract: null,
      isLoading: true,
      isPublicSale: false,
      isPreSale: false,
      isPresaleListed: null,
      isFreesaleListed: null,
      supplyCounter: 0,
      MAX_SUPPLY: 5555,
      numberOfTokens: 1,
      network: "4", //mainnet-1 testnet-4
      currentNetwork: "",
      WALLET_LIMIT: 2,
      maxMint: 0,
      balance: 0,
      step: 1,
      ABI: ABI,
      errorMessage: "",
      price: 0,
      presaleAddresses: presaleAddresses,
      freesaleAddresses: freesaleAddresses,
      url: "https://1-0-2--signer.bonkcrypto.autocode.gg/",
    };
  },
  mounted() {
    this.$nextTick(function () {
      //RE-INIT WF as Vue.js init breaks WF interactions
      Webflow.destroy();
      Webflow.ready();
      Webflow.require("ix2").init();
    });
  },
  methods: {
    async appInit() {
      try {
        // await web3Modal.clearCachedProvider();
        await this.connect();
        this.nftContract = new window.web3.eth.Contract(
          this.ABI,
          this.contractAddress
        );
        await this.initData();
        this.isLoading = false;
      } catch (e) {
        this.isLoading = false;
      }
    },
    async initData() {
      this.numberOfTokens = 1;
      this.balance = parseInt(
        await this.nftContract.methods.balanceOf(this.account).call()
      );
      this.supplyCounter = parseInt(
        await this.nftContract.methods.totalSupply().call()
      );
      this.MAX_SUPPLY = parseInt(
        await this.nftContract.methods.MAX_SUPPLY().call()
      );
      this.WALLET_LIMIT = parseInt(
        await this.nftContract.methods.MINT_LIMIT().call()
      );

      this.isPreSale = await this.nftContract.methods.isPresaleActive().call();
      this.isPublicSale = await this.nftContract.methods
        .isPublicSaleActive()
        .call();

      this.isPresaleListed =
        this.presaleAddresses.find(
          (x) => x.address.toLowerCase() == this.account?.toLowerCase()
        );

      this.isFreesaleListed =
        this.freesaleAddresses.find(
          (x) => x.address.toLowerCase() == this.account?.toLowerCase()
        );

      if (this.isPublicSale) {
        this.maxMint = this.WALLET_LIMIT - this.balance;
        this.price = web3.utils.fromWei(
          await this.nftContract.methods.PUBLIC_PRICE().call(),
          "ether"
        );
      } else if (this.isPreSale) {
        let addressMaxMint;
        if (this.isPresaleListed) {
          addressMaxMint = this.isPresaleListed.maxMint
          this.maxMint = addressMaxMint - this.balance;
        } else {
          this.maxMint = this.WALLET_LIMIT;
        }
        this.price = web3.utils.fromWei(
          await this.nftContract.methods.WL_PRICE().call(),
          "ether"
        );
      } else {
        this.maxMint = this.WALLET_LIMIT - this.balance;
        this.price = this.price = web3.utils.fromWei(
          await this.nftContract.methods.WL_PRICE().call(),
          "ether"
        );
      }
    },
    async connect() {
      const provider = await web3Modal.connect();
      window.web3 = new Web3(provider);
      window.web3.eth.handleRevert = true;
      let networkVersion = await window.web3.eth.getChainId();
      this.currentNetwork = networkVersion;
      if (this.currentNetwork != this.network) {
        this.currentNetwork  = await window.web3.eth.net.getId();
        await window.web3.currentProvider.request({
          method: 'wallet_switchEthereumChain',
            params: [{ chainId: Web3.utils.toHex(this.network) }],
          });
      }
      let accounts = await window.web3.eth.getAccounts();
      this.account = accounts[0];
    },
    async mint() {
      try {
        this.step = 2;
        let amount = window.web3.utils.toWei(
          (this.price * this.numberOfTokens).toString(),
          "ether"
        );
        let walletBalance = await window.web3.eth.getBalance(this.account);
        if (parseInt(walletBalance) <= parseInt(amount)) {
          this.processErrorMessage({
            message: "You do not have enough balance to mint.",
          });
        }
        var data = await this.requestSignature();
        try {
          await this.nftContract.methods
            .mint(this.numberOfTokens, data.expireTime, data.signature)
            .estimateGas({
              from: this.account,
              value: amount,
            });
        } catch (e) {
          this.processErrorMessage(e);
          this.step = 1;
          return;
        }
        let tx = await this.nftContract.methods
          .mint(this.numberOfTokens, data.expireTime, data.signature)
          .send({
            from: this.account,
            value: amount,
          });
        this.step = 3;
      } catch (e) {
        this.processErrorMessage(e);
        this.step = 1;
      }
      await this.initData();
    },

    async presaleMint() {
      try {
        this.step = 2;
        let amount = window.web3.utils.toWei(
          (this.price * this.numberOfTokens).toString(),
          "ether"
        );
        let walletBalance = await window.web3.eth.getBalance(this.account);
        if (parseInt(walletBalance) <= parseInt(amount)) {
          this.processErrorMessage({
            message: "You do not have enough balance to mint.",
          });
        }
        let merkle;
        let addressMaxMint;
        if (this.isPresaleListed) {
          merkle = this.generateProof(
            this.account,
            this.isPresaleListed.maxMint,
            this.presaleAddresses
          );
        } else {
          this.processErrorMessage({
            message: "You are not listed for presale.",
          });
          this.step = 1;
          return;
        }
        try {
          await this.nftContract.methods
            .presaleMint(merkle.proof, this.numberOfTokens, this.isPresaleListed.maxMint)
            .estimateGas({
              from: this.account,
              value: amount,
            });
        } catch (e) {
          console.log(e);
          this.processErrorMessage(e);

          return;
        }
        let tx = await this.nftContract.methods
          .presaleMint(merkle.proof, this.numberOfTokens, this.isPresaleListed.maxMint)
          .send({
            from: this.account,
            value: amount,
          });
        this.step = 3;
      } catch (e) {
        this.processErrorMessage(e);
        this.step = 1;
      }
      await this.initData();
    },

    async freeMint() {
      try {
        this.step = 2;
        let merkle;
        if (this.isFreesaleListed) {
          merkle = this.generateProof(
            this.account,
            this.isFreesaleListed.maxMint,
            this.freesaleAddresses
          );
        } else {
          this.processErrorMessage({
            message: "You are not listed for freesale.",
          });
          this.step = 1;
          return;
        }
        try {
          await this.nftContract.methods
            .freeMint(merkle.proof, this.numberOfTokens, this.isFreesaleListed.maxMint)
            .estimateGas({
              from: this.account,
            });
        } catch (e) {
          console.log(e);
          this.processErrorMessage(e);

          return;
        }
        let tx = await this.nftContract.methods
          .freeMint(merkle.proof, this.numberOfTokens, this.isFreesaleListed.maxMint)
          .send({
            from: this.account,
          });
        this.step = 3;
      } catch (e) {
        this.processErrorMessage(e);
        this.step = 1;
      }
      await this.initData();
    },

    processErrorMessage(error) {
      this.step = 1;
      const middle = error.message.slice(
        error.message.indexOf("{"),
        error.message.lastIndexOf("}") + 1
      );
      if (middle == "") {
        this.errorMessage = error.message;
      } else {
        var parsed = JSON.parse(middle);
        this.errorMessage = parsed.originalError.message;
      }
      toastr["error"](this.errorMessage);
    },
    splitAddress() {
      if (this.account) {
        return this.account.slice(0, 6) + "..." + this.account.slice(-4);
      }
    },
    increment() {
      if (this.numberOfTokens < this.maxMint) this.numberOfTokens++;
    },
    decrement() {
      if (this.numberOfTokens > 1) this.numberOfTokens--;
    },
    mintAgain() {
      this.step = 1;
    },
    //Http post request
    async requestSignature() {
      var data = {
        sender: this.account,
        numberOfTokens: this.numberOfTokens,
      };
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      return await response.json();
    },
    generateProof(address, maxMint, proofAddresses) {
      var leaves = proofAddresses.map((v, index) =>
        this.packData({ address: v.address.replace(/ /g,''), maxMint: v.maxMint})
      );
      var tree = new MerkleTree(leaves, keccak256, { sort: true });
      const leaf = this.packData({ address: address, maxMint: maxMint });
      const proof = tree.getHexProof(leaf);
      return { leaf: "0x" + leaf.toString("hex"), proof };
    },

    packData(data) {
      var hash = ethers.utils.solidityKeccak256(
        ["address", "uint256"],
        [data.address, data.maxMint]
      );
      return hash;
    },
  },
});

if (window.ethereum) {
  window.ethereum.on("chainChanged", (_chainId) => window.location.reload());
  window.ethereum.on("disconnect", (error) => window.location.reload());
  window.ethereum.on("accountsChanged", (error) => window.location.reload());
}
const vm = app.mount("#vue-app");
vm.appInit();
