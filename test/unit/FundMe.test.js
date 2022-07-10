const { isCommunityResourcable } = require("@ethersproject/providers")
const { assert, expect } = require("chai")
const { deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config.js")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", async function () {
          let fundMe
          let deployer
          let mockV3Aggregator
          const sendValue = ethers.utils.parseEther("1")
          beforeEach(async function () {
              // deploy fundMe contract
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              fundMe = await ethers.getContract("FundMe", deployer)
              mockV3Aggregator = await ethers.getContract(
                  "MockV3Aggregator",
                  deployer
              )
          })

          describe("constructor", async function () {
              it("sets the aggregator addresses correctly", async function () {
                  const response = await fundMe.getPriceFeed()
                  assert.equal(response, mockV3Aggregator.address)
              })
          })

          describe("fund", async function () {
              it("fails if sent insufficient ETH", async function () {
                  await expect(fundMe.fund()).to.be.revertedWith(
                      "You need to spend more ETH!"
                  )
              })
              it("updates the amount funded data structure", async function () {
                  await fundMe.fund({ value: sendValue })
                  const response = await fundMe.getAddressToAmountFunded(
                      deployer
                  )
                  assert.equal(response.toString(), sendValue.toString())
              })
              it("puts the lotion in the basket or it gets the hose again", async function () {
                  await fundMe.fund({ value: sendValue })
                  const funder = await fundMe.getFunders(0)
                  assert.equal(funder, deployer)
              })
          })

          describe("withdraw", async function () {
              beforeEach(async function () {
                  await fundMe.fund({ value: sendValue })
              })
              it("can withgdraw ETH from a single founder", async function () {
                  // arrange
                  const startingBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const startingdeployerBalance =
                      await fundMe.provider.getBalance(deployer)

                  // act
                  const txnResponse = await fundMe.cheaperWithdraw()
                  const txnReciept = await txnResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = txnReciept
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const endBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const endDeployerBalance = await fundMe.provider.getBalance(
                      deployer
                  )

                  //assert
                  assert.equal(
                      startingBalance.add(startingdeployerBalance).toString(),
                      endDeployerBalance.add(gasCost).toString()
                  )
                  assert.equal(endBalance, 0)
              })

              it("allows us to withdraw with multiple funders", async function () {
                  const accounts = await ethers.getSigners()
                  for (i = 1; i < 6; i++) {
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })
                  }
                  const startingBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )

                  const startingdeployerBalance =
                      await fundMe.provider.getBalance(deployer)

                  // act
                  // withdraw funds
                  const txnResponse = await fundMe.cheaperWithdraw()

                  const txnReciept = await txnResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = txnReciept
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  // assert
                  const endBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const endDeployerBalance = await fundMe.provider.getBalance(
                      deployer
                  )

                  assert.equal(
                      startingBalance.add(startingdeployerBalance).toString(),
                      endDeployerBalance.add(gasCost).toString()
                  )
                  assert.equal(endBalance, 0)

                  // funders array has been reset
                  await expect(fundMe.getFunders(0)).to.be.reverted

                  for (i = 1; i < 6; i++) {
                      assert.equal(
                          await fundMe.getAddressToAmountFunded(
                              accounts[i].address
                          ),
                          0
                      )
                  }
              })

              it("only allows owner to withdraw funds", async function () {
                  const accounts = await ethers.getSigners()
                  const attacker = accounts[1]
                  const attackerConnectedContract = await fundMe.connect(
                      attacker
                  )
                  await expect(attackerConnectedContract.withdraw())
              })
          })
      })
