const Vue = require("vue");
const presaleAddresses = require("../files/presaleAddresses.json");
const freesaleAddresses = require("../files/freesaleAddresses.json");
const MerkleTree = require("merkletreejs").default;
const ethers = require("ethers");
const keccak256 = require("keccak256");
const toastr = require("toastr");

const app = Vue.createApp({
  el: "#vue-app",
  data() {
    return {
      //Constants
      WL_ROOT: null,
      FREE_ROOT: null,
      address:'',
    };
  },
  methods: {
    async appInit() {
      this.generateRoot();
    },
    generateRoot() {
      var leaves = presaleAddresses.map((v, index) =>
        this.packData({ address: v.address, maxMint: v.maxMint})
      );
      console.log(leaves);
      var tree = new MerkleTree(leaves, keccak256, { sort: true });
      var root = tree.getHexRoot();
      console.log("WL addresses:" + presaleAddresses.length);
      console.log("WL Root: " + root);
      this.WL_ROOT = root;

      var leaves = freesaleAddresses.map((v, index) =>
        this.packData({ address: v.address, maxMint: v.maxMint })
      );
      var tree = new MerkleTree(leaves, keccak256, { sort: true });
      var root = tree.getHexRoot();
      console.log("Free addresses:" + freesaleAddresses.length);
      console.log("Free Root: " + root);
      this.FREE_ROOT = root;
    },
    checkAddress(){
      if(presaleAddresses.filter(
        (x) => x.address.toLowerCase() == this.address?.toLowerCase()
      ).length > 0){
        toastr.success("You are listed for presale.")
      }else{
        toastr.error("You are not listed for presale.");
      };
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

const vm = app.mount("#vue-app");
vm.appInit();
