// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract UbiqGuacamole is ERC721Enumerable, ReentrancyGuard, Pausable, Ownable {
    using Strings for uint256;

    uint256 public constant MAX_SUPPLY = 5000;
    bytes32 private lastHash;
    uint256 private seed;
    uint256 private constant COOLDOWN_PERIOD = 0 minutes;
    uint256 private lastGenerationTimestamp;
    mapping(address => uint256) private userRequestData;

    uint256 private tokenIdCounter;

    struct GuacamoleAttributes {
        uint256 bowlColor;
        uint256 guacamoleColor;
        uint8 numIngredientTypes;
        uint256 ingredientSeed;
    }

    mapping(uint256 => GuacamoleAttributes) private tokenIdToAttributes;

    event RandomNumberRequested(address indexed requester, uint256 requestId);
    event NFTMinted(address indexed owner, uint256 indexed tokenId);

    struct RandomRequest {
        address requester;
        uint256 requestTimestamp;
        bytes32 requesterSpecificSeed;
    }

    mapping(uint256 => RandomRequest) private randomRequests;
    uint256 private requestIdCounter;

    string[15] private ingredientColors = [
        "#FF6347", // tomato
        "#FFFFFF", // onion
        "#FF4500", // red bell pepper
        "#32CD32", // cilantro
        "#FFD700", // mango
        "#228B22", // jalapeno
        "#98FB98", // avocado chunks
        "#8B0000", // red onion
        "#FFD700", // corn
        "#4B0082", // black beans
        "#00FF00", // lime
        "#F5F5DC", // garlic
        "#00FF00", // green pepper
        "#FFFF00", // yellow pepper
        "#FFA500" // carrot
    ];

    constructor(address initialOwner) ERC721("UbiquitousGuacamole", "GUAC") {
        lastHash = blockhash(block.number - 1);
        seed = uint256(
            keccak256(
                abi.encodePacked(block.timestamp, block.prevrandao, msg.sender)
            )
        );
        lastGenerationTimestamp = block.timestamp;

        transferOwnership(initialOwner);
    }

    function requestMint()
        external
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        require(totalSupply() < MAX_SUPPLY, "Maximum supply reached");

        uint256 userData = userRequestData[msg.sender];
        uint256 lastRequestTime = userData & 0xFFFFFFFFFFFFFFFF; // Extract lower 64 bits
        uint256 requestCount = userData >> 64; // Extract upper 64 bits

        require(
            block.timestamp - lastRequestTime >= 5 minutes,
            "Please wait before making another request"
        );
        require(requestCount < 5, "Maximum request limit reached");

        // Update user request data
        userRequestData[msg.sender] =
            ((++requestCount) << 64) |
            uint64(block.timestamp);

        randomRequests[++requestIdCounter] = RandomRequest({
            requester: msg.sender,
            requestTimestamp: block.timestamp,
            requesterSpecificSeed: keccak256(
                abi.encodePacked(msg.sender, block.timestamp, seed)
            )
        });

        emit RandomNumberRequested(msg.sender, requestIdCounter);

        return requestIdCounter;
    }

    function fulfillMint(
        uint256 requestId
    ) external nonReentrant whenNotPaused returns (uint256) {
        RandomRequest memory request = randomRequests[requestId];

        require(request.requester != address(0), "Invalid request ID");
        require(
            block.timestamp - request.requestTimestamp >= COOLDOWN_PERIOD,
            "Please wait for the cooldown period"
        );
        require(
            block.timestamp - lastGenerationTimestamp >= COOLDOWN_PERIOD,
            "Generation cooldown period not met"
        );

        delete randomRequests[requestId];

        bytes32 newHash = keccak256(
            abi.encodePacked(
                lastHash,
                block.timestamp,
                block.prevrandao,
                block.coinbase,
                blockhash(block.number - 1),
                msg.sender,
                seed,
                request.requesterSpecificSeed,
                tx.gasprice,
                gasleft(),
                address(this).balance,
                request.requester.balance
            )
        );

        uint256 randomNumber = uint256(newHash);

        lastHash = newHash;
        seed = uint256(
            keccak256(
                abi.encodePacked(
                    seed,
                    randomNumber,
                    block.number,
                    request.requesterSpecificSeed
                )
            )
        );
        lastGenerationTimestamp = block.timestamp;

        uint256 newTokenId = ++tokenIdCounter;

        setGuacamoleAttributes(newTokenId, randomNumber);

        _safeMint(request.requester, newTokenId);

        emit NFTMinted(request.requester, newTokenId);

        return newTokenId;
    }

    function setGuacamoleAttributes(
        uint256 tokenId,
        uint256 randomNumber
    ) private {
        tokenIdToAttributes[tokenId] = GuacamoleAttributes({
            bowlColor: randomNumber % 0xFFFFFF,
            guacamoleColor: generateGuaranteedGreen(randomNumber),
            numIngredientTypes: uint8(((randomNumber >> 48) % 13) + 3), // 3 to 15 ingredient types
            ingredientSeed: randomNumber
        });
    }

    function generateGuaranteedGreen(
        uint256 randomNumber
    ) private pure returns (uint256) {
        unchecked {
            uint256 red = ((randomNumber >> 8) & 0xFF) % 101; // 0-100
            uint256 green = ((randomNumber & 0xFF) % 76) + 180; // 180-255
            uint256 blue = ((randomNumber >> 16) & 0xFF) % 101; // 0-100
            return (red << 16) | (green << 8) | blue;
        }
    }

    function generateSVG(uint256 tokenId) public view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        GuacamoleAttributes memory attrs = tokenIdToAttributes[tokenId];

        string memory bowlSVG = generateBowlSVG(
            attrs.bowlColor,
            attrs.guacamoleColor
        );
        string memory ingredientsSVG = generateIngredientsSVG(
            attrs.numIngredientTypes,
            attrs.ingredientSeed
        );

        return
            string.concat(
                '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">',
                bowlSVG,
                ingredientsSVG,
                "</svg>"
            );
    }

    function generateBowlSVG(
        uint256 bowlColor,
        uint256 guacamoleColor
    ) private pure returns (string memory) {
        return
            string.concat(
                '<circle cx="100" cy="100" r="90" fill="',
                toColorHexString(bowlColor),
                '" />',
                '<circle cx="100" cy="100" r="85" fill="#A0522D" />',
                '<circle cx="100" cy="100" r="75" fill="',
                toColorHexString(guacamoleColor),
                '" />'
            );
    }

    function generateIngredientsSVG(
        uint8 numIngredientTypes,
        uint256 ingredientSeed
    ) private view returns (string memory) {
        string memory ingredientsSVG = "";
        for (uint i = 0; i < numIngredientTypes; ) {
            ingredientsSVG = string.concat(
                ingredientsSVG,
                generateIngredientTypeSVG(ingredientSeed)
            );
            ingredientSeed = uint256(
                keccak256(abi.encodePacked(ingredientSeed))
            );

            unchecked {
                ++i;
            }
        }
        return ingredientsSVG;
    }

    function generateIngredientTypeSVG(
        uint256 ingredientSeed
    ) private view returns (string memory) {
        string memory ingredientColor = ingredientColors[ingredientSeed % 15];
        uint256 numIngredients = (ingredientSeed % 18) + 3; // 3 to 20 ingredients
        string memory typeSVG = "";

        for (uint j = 0; j < numIngredients; ) {
            (
                uint256 cx,
                uint256 cy,
                uint256 newSeed
            ) = generateIngredientPosition(ingredientSeed);
            ingredientSeed = newSeed;

            if (isWithinBowl(cx, cy)) {
                typeSVG = string.concat(
                    typeSVG,
                    generateSingleIngredientSVG(
                        cx,
                        cy,
                        ingredientColor,
                        ingredientSeed
                    )
                );
            }

            unchecked {
                ++j;
            }
        }

        return typeSVG;
    }

    function generateIngredientPosition(
        uint256 ingredientSeed
    ) private pure returns (uint256 cx, uint256 cy, uint256 newSeed) {
        cx = (ingredientSeed % 141) + 30; // 30 to 170
        ingredientSeed >>= 8;
        cy = (ingredientSeed % 141) + 30; // 30 to 170
        newSeed = ingredientSeed >> 8;
        return (cx, cy, newSeed);
    }

    function generateSingleIngredientSVG(
        uint256 cx,
        uint256 cy,
        string memory color,
        uint256 ingredientSeed
    ) private pure returns (string memory) {
        uint256 rx = (ingredientSeed % 4) + 3; // 3 to 6
        ingredientSeed >>= 2;
        uint256 ry = (ingredientSeed % 4) + 3; // 3 to 6
        ingredientSeed >>= 2;
        uint256 rotation = ingredientSeed % 360;

        return
            string.concat(
                '<ellipse cx="',
                cx.toString(),
                '" cy="',
                cy.toString(),
                '" rx="',
                rx.toString(),
                '" ry="',
                ry.toString(),
                '" fill="',
                color,
                '" transform="rotate(',
                rotation.toString(),
                ",",
                cx.toString(),
                ",",
                cy.toString(),
                ')" />'
            );
    }

    function isWithinBowl(uint256 x, uint256 y) private pure returns (bool) {
        unchecked {
            if (x > 100) x -= 100;
            else x = 100 - x;
            if (y > 100) y -= 100;
            else y = 100 - y;
            return (x * x + y * y) <= 4900; // 70^2
        }
    }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        string memory svg = generateSVG(tokenId);
        GuacamoleAttributes memory guacamoleAttributes = tokenIdToAttributes[
            tokenId
        ];
        string memory bowlColor = toColorHexString(
            guacamoleAttributes.bowlColor
        );
        string memory guacamoleColor = toColorHexString(
            guacamoleAttributes.guacamoleColor
        );
        string memory numberOfIngredientTypes = uint256(
            guacamoleAttributes.numIngredientTypes
        ).toString();

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "Guacamole #',
                        tokenId.toString(),
                        '", "bowlColor": "',
                        bowlColor,
                        '", "guacamoleColor": "',
                        guacamoleColor,
                        '", "numIngredientTypes": ',
                        numberOfIngredientTypes,
                        ', "ingredientSeed": "',
                        guacamoleAttributes.ingredientSeed.toString(),
                        '", "description": "A generative guacamole NFT. The bowl color is ',
                        bowlColor,
                        " and the guacamole color is ",
                        guacamoleColor,
                        ". It has ",
                        numberOfIngredientTypes,
                        " ingredient types.",
                        '", "image": "data:image/svg+xml;base64,',
                        Base64.encode(bytes(svg)),
                        '"}'
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function toColorHexString(
        uint256 color
    ) private pure returns (string memory) {
        bytes memory buffer = new bytes(7);
        buffer[0] = "#";

        bytes16 alphabet = "0123456789ABCDEF";

        for (uint256 i = 6; i > 0; ) {
            buffer[i] = alphabet[color & 0xF];
            color >>= 4;

            unchecked {
                --i;
            }
        }

        return string(buffer);
    }

    receive() external payable {
        seed = uint256(
            keccak256(abi.encodePacked(seed, msg.value, block.timestamp))
        );
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function withdraw() external onlyOwner {
        (bool success, ) = msg.sender.call{value: address(this).balance}("");
        require(success, "Transfer failed.");
    }

    function viewMintRequest(
        uint256 requestId
    ) external view returns (address, uint256) {
        RandomRequest memory request = randomRequests[requestId];
        return (request.requester, request.requestTimestamp);
    }

    function cancelMintRequest(uint256 requestId) external {
        require(
            randomRequests[requestId].requester == msg.sender,
            "Not your request"
        );
        delete randomRequests[requestId];

        uint256 userData = userRequestData[msg.sender];
        uint256 requestCount = userData >> 64;
        uint256 lastRequestTime = userData & 0xFFFFFFFFFFFFFFFF;

        userRequestData[msg.sender] =
            ((--requestCount) << 64) |
            lastRequestTime;
    }
}
