# nft-minting
First version of the old AROX NFT Bot, could autoparse most react-based CM v1 and v2 sites for automatic NFT minting. Also worked on NEAR Contracts.
Code is horrible, but it worked. I'm not a TS dev so most was trial-and-error.

Open-sources as this hasn't been used in 1+ year.
All API endpoints in project are closed, so no point in trying to hammer them :)


# Build:
tsc -p .

cd tsc-out

pkg index.js —-out-path BUILD
