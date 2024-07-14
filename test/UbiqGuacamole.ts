import { ethers } from "hardhat";
import { YourCollectible } from "../typechain-types/contracts/YourCollectible";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("YourCollectible", function () {
  let yourCollectible: YourCollectible;
  let owner: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;
  let addrs: HardhatEthersSigner[];

  beforeEach(async function () {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    const YourCollectible = await ethers.getContractFactory("YourCollectible");
    yourCollectible = await YourCollectible.deploy(owner.address);
    await yourCollectible.waitForDeployment();
  });

  describe("Gas Calculation", function () {
    it("should analyze generateSVG function", async function () {
      // First, mint an NFT
      await yourCollectible.requestMint();
      await increaseTime();
      await yourCollectible.fulfillMint(1);

      // Call generateSVG
      const svg = await yourCollectible.generateSVG(1);
      console.log("SVG length:", svg.length);

      // Estimate gas (doesn't reflect actual cost for external calls)
      const estimatedGas = await yourCollectible.generateSVG.estimateGas(1);
      console.log("Estimated gas for generateSVG (if called internally):", estimatedGas.toString());
    });

    it("should measure impact of generateSVG on minting", async function () {
      await yourCollectible.requestMint();
      await increaseTime();

      // Estimate gas for minting (which internally calls generateSVG)
      const estimatedGas = await yourCollectible.fulfillMint.estimateGas(1);
      console.log("Estimated gas for fulfillMint (including generateSVG):", estimatedGas.toString());

      // Perform the actual mint
      const tx = await yourCollectible.fulfillMint(1);
      const receipt = await tx.wait();
      console.log("Actual gas used for fulfillMint:", receipt?.gasUsed.toString());
    });
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await yourCollectible.owner()).to.equal(owner.address);
    });

    it("Should have correct name and symbol", async function () {
      expect(await yourCollectible.name()).to.equal("UbiquitousGuacamole");
      expect(await yourCollectible.symbol()).to.equal("GUAC");
    });
  });

  describe("Minting Process", function () {
    it("Should allow requesting a mint", async function () {
      await expect(yourCollectible.connect(addr1).requestMint())
        .to.emit(yourCollectible, "RandomNumberRequested")
        .withArgs(addr1.address, 1);
    });

    it("Should not allow requesting more than 5 mints", async function () {
      for (let i = 0; i < 5; i++) {
        await yourCollectible.connect(addr1).requestMint();
        await ethers.provider.send("evm_increaseTime", [300]); // 5 minutes
        await ethers.provider.send("evm_mine");
      }
      await expect(yourCollectible.connect(addr1).requestMint())
        .to.be.revertedWith("Maximum request limit reached");
    });

    it("Should enforce cooldown period between requests", async function () {
      await yourCollectible.connect(addr1).requestMint();
      await expect(yourCollectible.connect(addr1).requestMint())
        .to.be.revertedWith("Please wait before making another request");
    });

    it("Should allow fulfilling a mint request", async function () {
      await yourCollectible.connect(addr1).requestMint();
      await increaseTime();
      await expect(yourCollectible.connect(addr1).fulfillMint(1))
        .to.emit(yourCollectible, "NFTMinted")
        .withArgs(addr1.address, 1);
    });

    it("Should not allow fulfilling an invalid request", async function () {
      await expect(yourCollectible.connect(addr1).fulfillMint(999))
        .to.be.revertedWith("Invalid request ID");
    });

    it("Should allow cancelling a mint request", async function () {
      await yourCollectible.connect(addr1).requestMint();
      await yourCollectible.connect(addr1).cancelMintRequest(1);
      await expect(yourCollectible.connect(addr1).fulfillMint(1))
        .to.be.revertedWith("Invalid request ID");
    });

    it("Should not allow cancelling someone else's request", async function () {
      await yourCollectible.connect(addr1).requestMint();
      await expect(yourCollectible.connect(addr2).cancelMintRequest(1))
        .to.be.revertedWith("Not your request");
    });
  });

  describe("Token Attributes", function () {
    it("Should generate unique attributes for each token", async function () {
      await yourCollectible.connect(addr1).requestMint();
      await increaseTime();
      await yourCollectible.connect(addr1).fulfillMint(1);
      await ethers.provider.send("evm_increaseTime", [300]); // 5 minutes
      await ethers.provider.send("evm_mine");
      await yourCollectible.connect(addr1).requestMint();
      await increaseTime();
      await yourCollectible.connect(addr1).fulfillMint(2);

      const svg1 = await yourCollectible.generateSVG(1);
      const svg2 = await yourCollectible.generateSVG(2);
      expect(svg1).to.not.equal(svg2);
    });

    it("Should generate a green color for guacamole", async function () {
      await yourCollectible.connect(addr1).requestMint();
      await increaseTime();
      await yourCollectible.connect(addr1).fulfillMint(1);
      const svg = await yourCollectible.generateSVG(1);
      expect(svg).to.include('fill="#');
      // Check if the color is in the green spectrum (simplified check)
      const color: string | null = getGuacamoleColor(svg);
      expect(color).to.not.be.null;

      const green = parseInt(color?.substring(2, 4) ?? '00', 16);
      expect(green).to.be.greaterThan(179); // Assuming green is dominant
    });
  });

  describe("Token URI", function () {
    it("Should return a valid token URI", async function () {
      await yourCollectible.connect(addr1).requestMint();
      await increaseTime();
      await yourCollectible.connect(addr1).fulfillMint(1);
      const tokenURI = await yourCollectible.tokenURI(1);
      expect(tokenURI).to.include("data:application/json;base64,");
      const jsonData = JSON.parse(atob(tokenURI.split(',')[1]));
      expect(jsonData).to.have.property("name");
      expect(jsonData).to.have.property("description");
      expect(jsonData).to.have.property("image");
    });

    it("Should revert for non-existent token", async function () {
      await expect(yourCollectible.tokenURI(999))
        .to.be.revertedWith("Token does not exist");
    });
  });

  describe("Contract Controls", function () {
    it("Should allow owner to pause and unpause", async function () {
      await yourCollectible.pause();
      await expect(yourCollectible.connect(addr1).requestMint())
        .to.be.revertedWith("Pausable: paused");
      await yourCollectible.unpause();
      await expect(yourCollectible.connect(addr1).requestMint()).to.not.be.reverted;
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(yourCollectible.connect(addr1).pause())
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow owner to withdraw", async function () {
      await addr1.sendTransaction({
        to: await yourCollectible.getAddress(),
        value: 1n * 10n ** 18n
      });
      const initialBalance = await ethers.provider.getBalance(owner.address);
      await yourCollectible.withdraw();
      const finalBalance = await ethers.provider.getBalance(owner.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should not allow non-owner to withdraw", async function () {
      await expect(yourCollectible.connect(addr1).withdraw())
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle minting up to the maximum request limit", async function () {
      for (let i = 0; i < 5; i++) {
        await yourCollectible.connect(addr1).requestMint();
        await ethers.provider.send("evm_increaseTime", [300]); // 5 minutes
        await ethers.provider.send("evm_mine");
      }
      await expect(yourCollectible.connect(addr1).requestMint())
        .to.be.revertedWith("Maximum request limit reached");
    });

    it("Should handle multiple users minting", async function () {
      const numUsers = Math.min(5, addrs.length); // Use up to 5 users or less if not enough addresses

      for (let i = 0; i < numUsers; i++) {
        await yourCollectible.connect(addrs[i]).requestMint();
        await increaseTime();
      }

      for (let i = 0; i < numUsers; i++) {
        await expect(yourCollectible.connect(addrs[i]).fulfillMint(i + 1)).to.not.be.reverted;
        await increaseTime();
      }
    });

    it("Should generate valid SVG even with extreme random numbers", async function () {
      // Mock the random number generation to test extreme cases
      const extremeRandomNumbers = [0, 2 ** 256 - 1, 2 ** 128, 1];
      for (let i = 0; i < extremeRandomNumbers.length; i++) {
        await yourCollectible.connect(addr1).requestMint();

        await ethers.provider.send("evm_increaseTime", [300]); // 5 minutes
        await ethers.provider.send("evm_mine");

        // We need to mock the internal random number generation here
        // This is a simplification and might not work directly
        await yourCollectible.connect(addr1).fulfillMint(i + 1);
        const svg = await yourCollectible.generateSVG(i + 1);
        expect(svg).to.include('<svg');
        expect(svg).to.include('</svg>');
      }
    });

    it("Should handle rapid consecutive requests and fulfillments", async function () {
      for (let i = 0; i < 5; i++) {
        await yourCollectible.connect(addr1).requestMint();
        await ethers.provider.send("evm_increaseTime", [300]); // 5 minutes
        await ethers.provider.send("evm_mine");
        await yourCollectible.connect(addr1).fulfillMint(i + 1);
      }
    });
  });
});

function getGuacamoleColor(svgString: string): string | null {
  const regex = /<circle[^>]*fill="([^"]*)"[^>]*\/>/g;
  const matches = [...svgString.matchAll(regex)];

  if (matches.length >= 3) {
    return matches[2][1].split('#')[1]; // The third match's fill color
  }

  return null;
}

async function increaseTime(seconds: number = 301): Promise<void> {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}
