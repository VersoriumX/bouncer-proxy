import React, { Component } from 'react';
import { Metamask, Gas, ContractLoader, Transactions, Events, Scaler, Blockie, Address, Button } from "dapparatus"
import Web3 from 'web3';
import './App.css';
import Owner from "./components/owner.js"
import AllBouncers from "./components/allBouncers.js"
import Bouncer from "./components/bouncer.js"
import Backend from "./components/backend.js"
import Miner from "./components/miner.js"
import QRCode from 'qrcode.react';
import axios from 'axios';

const Room = require('ipfs-pubsub-room')
const IPFS = require('ipfs')
const ipfs = new IPFS({
  repo: './ipfs',
  EXPERIMENTAL: {
    pubsub: true
  },
  config: {
    Addresses: {
      Swarm: [
        '/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star'
      ]
    }
  }
})
const IPFSROOMNAME = "bouncer-proxy"

let backendUrl = "http://localhost:10001/"
console.log("window.location:",window.location)
try {
  const url = new URL(window.location.href);
  const allowedHosts = ["metatx.io", "www.metatx.io"];
  if (allowedHosts.includes(url.host)) {
    backendUrl = "https://backend.metatx.io/"
  }
} catch (e) {
  console.error("Invalid URL:", e);
}

class App extends Component {
  constructor(props) {
   super(props);
   this.state = {
     web3: false,
     account: false,
     gwei: 4,
     address: window.location.pathname.replace("/",""),
     contract: false,
     owner: "",
     bouncer: "",
     ipfs: Room(ipfs,IPFSROOMNAME),
     ipfsSigs: Room(ipfs,IPFSROOMNAME+"Sigs"),
     ipfsMiners: Room(ipfs,IPFSROOMNAME+"Miners")
   }
  }
  deployBouncerProxy() {
    let {web3,tx,contracts} = this.state
    console.log("Deploying bouncer...")
    let code = require("./contracts/BouncerProxy.bytecode.js")
    tx(contracts.BouncerProxy._contract.deploy({data:code}),1220000,(receipt)=>{
      console.log("~~~~~~ DEPLOY FROM DAPPARATUS:",receipt)
      if(receipt.contractAddress){
        axios.post(backendUrl+'deploy', receipt, {
          headers: {
              'Content-Type': 'application/json',
          }
        }).then((response)=>{
          console.log("CACHE RESULT",response)
          window.location = "/"+receipt.contractAddress
        })
        .catch((error)=>{
          console.log(error);
          window.location = "/"+receipt.contractAddress
        })
      }
    })

  }
  updateBouncer(value){
    console.log("UPDATE BOUNCER",value)
    this.setState({bouncer:value})
  }
  render() {
    let {web3,account,contracts,tx,gwei,block,avgBlockTime,etherscan} = this.state

    let metamask = (
      <Metamask
        config={{requiredNetwork:['Unknown','Rinkeby']}}
        onUpdate={(state)=>{
          console.log("metamask state update:",state)
          if(state.web3Provider) {
            state.web3 = new Web3(state.web3Provider)
            this.setState(state)
          }
        }}
      />
    )

    let connectedDisplay = ""
    let events = ""
    if(web3){
      connectedDisplay = (
        <div>
          <ContractLoader
            config={{DEBUG:true}}
            web3={web3}
            require={path => {return require(`${__dirname}/${path}`)}}
            onReady={(contracts,customLoader)=>{
              console.log("contracts loaded",contracts)
              this.setState({contracts:contracts},async ()=>{
                if(this.state.address){
                  console.log("Loading dyamic contract "+this.state.address)
                  let dynamicContract = customLoader("BouncerProxy",this.state.address)//new this.state.web3.eth.Contract(require("./contracts/BouncerProxy.abi.js"),this.state.address)
                  console.log("Checking to see if "+this.state.account+" is whitelisted in contract",dynamicContract)
                  let whitelisted = await dynamicContract.whitelist(this.state.account).call()
                  console.log("whitelisted:",whitelisted)
                  this.setState({contract:dynamicContract,whitelisted:whitelisted})
                }
              })
            }}
          />
          <Transactions
            config={{DEBUG:false}}
            account={account}
            gwei={gwei}
            web3={web3}
            block={block}
            avgBlockTime={avgBlockTime}
            etherscan={etherscan}
            onReady={(state)=>{
              console.log("Transactions component is ready:",state)
              this.setState(state)
            }}
            onReceipt={(transaction,receipt)=>{
              // this is one way to get the deployed contract address, but instead I'll switch
              //  to a more straight forward callback system above
              console.log("Transaction Receipt",transaction,receipt)
              /*if(receipt.contractAddress){
                window.location = "/"+receipt.contractAddress
              }*/
            }}
          />
          <Gas
            onUpdate={(state)=>{
              console.log("Gas price update:",state)
              this.setState(state,()=>{
                console.log("GWEI set:",this.state)
              })
            }}
          />
        </div>
      )
    }

    let mainTitle = ""
    let contractDisplay = ""
    let qr = ""
    let backend = ""

    if(web3 && contracts){
      if(!this.state.address){
        mainTitle = (
          <div className="titleCenter" style={{marginTop:-50,width:"100%"}}>
            <Scaler config={{origin:"50px center"}}>
            <div style={{width:"100%",textAlign:"center",fontSize:150}}>
             metatx.io
            </div>
            <div style={{width:"100%",textAlign:"center",fontSize:14,marginBottom:20}}>
             exploring etherless meta transactions and universal logins in ethereum
            </div>
            <div style={{width:"100%",textAlign:"center"}}>
              <Button size="2" onClick={()=>{
                window.location = "https://github.com/austintgriffith/bouncer-proxy/blob/master/README.md"
              }}>
              LEARN MORE
              </Button>
              <Button color="green" size="2" onClick={this.deployBouncerProxy.bind(this)}>
              DEPLOY
              </Button>
            </div>


            <div style={{marginTop:150}}>
              <AllBouncers
                backendUrl={backendUrl}
              />
            </div>

            </Scaler>


          </div>

        )

      }else if(this.state.contract){

        qr = (
          <div style={{position:"fixed",top:100,right:20}}>
              <Scaler config={{startZoomAt:900,origin:"150px 0px"}}>
                <QRCode value={window.location.toString()} />
              </Scaler>
          </div>
        )

        backend = (
          <Backend
            {...this.state}
            backendUrl={backendUrl}
            updateBouncer={this.updateBouncer.bind(this)}
          />
        )

        let userDisplay = ""
        if(this.state.whitelisted){

          userDisplay = (
            <div>
              <Owner
                {...this.state}
                onUpdate={(bouncerUpdate)=>{
                  console.log("bouncerUpdate",bouncerUpdate)
                  this.setState(bouncerUpdate)
                }}
                updateBouncer={this.updateBouncer.bind(this)}
              />
              <div>
                <Bouncer
                  {...this.state}
                  backendUrl={backendUrl}
                />
              </div>
            </div>
          )
        }else{
          userDisplay = (
            <div>
              <Bouncer
                {...this.state}
                backendUrl={backendUrl}
              />
            </div>
          )
        }

        let whitelisted = ""
        console.log("WHITELISTED",this.state.whitelisted)
        if(this.state.whitelisted){
          whitelisted = "(You are whitelisted to transact through this contract)"
        }

        contractDisplay = (
          <div style={{padding:20}}>
            <Miner backendUrl={backendUrl} {...this.state} />
            <Scaler config={{startZoomAt:900}}>
              <h1><a href="/">metatx.io</a></h1>
              <div>
                <Address
                  {...this.state}
                  address={this.state.contract._address}
                />
                {whitelisted}
              </div>
            </Scaler>
            {userDisplay}
          </div>
        )
      }else{
        contractDisplay = (
          <div style={{padding:20}}>
            Connecting to {this.state.address}
          </div>
        )
      }
    }else{
      contractDisplay = (
        <div style={{padding:20}}>
          <div className="titleCenter" style={{marginTop:-50}}>
            <Scaler config={{origin:"center center"}}>
            <div style={{width:"100%",textAlign:"center",fontSize:150}}>
             metatx.io
            </div>
            <div style={{width:"100%",textAlign:"center",fontSize:14,marginBottom:20}}>
             please unlock metamask or mobile web3 provider
            </div>
            <div style={{width:"100%",textAlign:"center"}}>
              <Button size="2" onClick={()=>{
                window.location = "https://github.com/austintgriffith/bouncer-proxy/blob/master/README.md"
              }}>
              LEARN MORE
              </Button>
              <Button color="orange" size="2" onClick={()=>{
                alert("Please unlock Metamask or install web3 or mobile ethereum wallet.")
              }}>
              DEPLOY
              </Button>
            </div>
            </Scaler>
          </div>
        </div>
      )
    }

    return (
      <div className="App">
        {metamask}
        {connectedDisplay}
        {events}
        {mainTitle}
        {contractDisplay}
        {qr}
        {backend}
      </div>
    );
  }
}

export default App;
