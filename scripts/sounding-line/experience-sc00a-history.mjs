// Immutable historical identities only; this file grants no execution.
const freeze = (value) => {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
export const SC00A_HISTORY = freeze({
  version: 1,
  sourceConsumerCommit: "53761d8259275a57398537c65c8e8978ebdfbf3e",
  archive: [
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-NORMAL-CHOICES_READY-1.png",
      blob: "ac6a294afd971f69b3e2c1b5ff85c81445837e0b",
      sha256: "db939ca7153c92cdb9f4c992489c091db693aeeb336d5c4b3605d8966b3431e9",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-NORMAL-CHOICES_READY-2.png",
      blob: "ac6a294afd971f69b3e2c1b5ff85c81445837e0b",
      sha256: "db939ca7153c92cdb9f4c992489c091db693aeeb336d5c4b3605d8966b3431e9",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-NORMAL-RETURNED-4.png",
      blob: "f756d74b1f936eb31478cbcdb0c4f91592f55c4b",
      sha256: "8b68235418fe8234749bce00f8efcc0f27bcf5dac0b44110445ab755fd448af0",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-NORMAL-CHOICES_READY-6.png",
      blob: "ac6a294afd971f69b3e2c1b5ff85c81445837e0b",
      sha256: "db939ca7153c92cdb9f4c992489c091db693aeeb336d5c4b3605d8966b3431e9",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-NORMAL-EDITOR_READY-8.png",
      blob: "4f447ff02feb68247ca697808fb78f14415a362d",
      sha256: "d952d302f83e3ae763bbe1a3ba687d5d1b59dfe3ea4cd62f045e4db8c329d7c6",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-NORMAL-DETAILS_SAVED-15.png",
      blob: "82c1d33395c9602c000c09a494f7bf9e4598029f",
      sha256: "6b3a585e3d79ad42c865fd99086eedc5c1d4ed292a3f108ea3dc3234ed9c20bc",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-NORMAL-LIBRARY_RETURNED-18.png",
      blob: "0a25b193cd93de226879eac2b2bb1d90b757f8fe",
      sha256: "39e6517cdc45b8396382ad6d25bc6ed0c522df7e7b3cb44e74b41eb731c66aaf",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-NORMAL-RETURNED-20.png",
      blob: "ac6a294afd971f69b3e2c1b5ff85c81445837e0b",
      sha256: "db939ca7153c92cdb9f4c992489c091db693aeeb336d5c4b3605d8966b3431e9",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-NORMAL.trace.zip",
      blob: "b90257ce293d797387f7833b33c0b7c1e96c52c6",
      sha256: "3dfd6a18f3083891cd4d745d92e657df5174afab9184897b5bd9a9eb0b473fe6",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/6a125aad1e79a91e0e954933e0d2039f.webm",
      blob: "47b42f49fda7d75b1cd1373f806735cef2cab689",
      sha256: "5150100023af72e9ef6d13319e606a632de62bc4bbf222dbce7c6c42ad446953",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-REDUCED-CHOICES_READY-1.png",
      blob: "87fa5d6130413bae6903b3d2c9275cf877dcbf76",
      sha256: "151865a54d0660afbde77efccf280bf4ee64303712264653e4344cc312092584",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-REDUCED-CHOICES_READY-2.png",
      blob: "87fa5d6130413bae6903b3d2c9275cf877dcbf76",
      sha256: "151865a54d0660afbde77efccf280bf4ee64303712264653e4344cc312092584",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-REDUCED-RETURNED-4.png",
      blob: "0a25b193cd93de226879eac2b2bb1d90b757f8fe",
      sha256: "39e6517cdc45b8396382ad6d25bc6ed0c522df7e7b3cb44e74b41eb731c66aaf",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-REDUCED-CHOICES_READY-6.png",
      blob: "87fa5d6130413bae6903b3d2c9275cf877dcbf76",
      sha256: "151865a54d0660afbde77efccf280bf4ee64303712264653e4344cc312092584",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-REDUCED-EDITOR_READY-8.png",
      blob: "6ce56f7717e03112090e7f503fed5590d7e00c55",
      sha256: "63855fe24141eda6bd9bae85c058bd268306131e5b84270641a3848f30aa6e81",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-REDUCED-DETAILS_SAVED-15.png",
      blob: "4831147287f6cf6c4abcec69f53a4449333f345f",
      sha256: "5123ff46786bf44d19043e1092d6b62d157563db5419696d1a6df13b509245af",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-REDUCED-LIBRARY_RETURNED-18.png",
      blob: "9842e35cf1b10e234f368a22d549700d2ec24ca1",
      sha256: "93207ee215c5d96e294d533a70564df28864a3a888baec1b59832d38e7a51bfd",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-REDUCED-RETURNED-20.png",
      blob: "80f305fb204c32c4ece6ac338b88fdcf63db87c9",
      sha256: "c56bdf080362d19907f205d831a9a055868ef76eb19f0a3a41c5a8110350db63",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-DESKTOP-CREATOR-REDUCED.trace.zip",
      blob: "246615e7c0d69a39b8ac9ffc0c4c28de518e39da",
      sha256: "b8d71c7a5a413be1542d392e0326a4d5ad0cadd9a3eae11411207f63b9c195f0",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/b23d0a4e5ffef60ff78d7b48f134217f.webm",
      blob: "66cf9aeaab23d1a162aa24e038b2b9e20ba05fd9",
      sha256: "20ebc8c593316eac81def154a0e04c48b46ff2a6c96463c7958621e1d1b0a5d9",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-NORMAL-CHOICES_READY-1.png",
      blob: "ff54691137ee6a6d40bca5fa9da8fc2c2e0b7974",
      sha256: "672de360a1a45ecdf3b2f44545d56ccedb4bfc930fae9ad4f4cf1696720bfe7c",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-NORMAL-CHOICES_READY-2.png",
      blob: "ff54691137ee6a6d40bca5fa9da8fc2c2e0b7974",
      sha256: "672de360a1a45ecdf3b2f44545d56ccedb4bfc930fae9ad4f4cf1696720bfe7c",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-NORMAL-RETURNED-4.png",
      blob: "a9d44bb1c4a158025848afe04d0437ee26782bff",
      sha256: "65df17846532dfbd88710d1521c9227a1192d6935c79f88fbe8d2b6af796604d",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-NORMAL-CHOICES_READY-6.png",
      blob: "61d78cdd7e37176b460fedc47e94e608a3b9bbd3",
      sha256: "49faf5c82572eac2500b390f88b47195565460ca51415a6eacbf6bd0330dcfe4",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-NORMAL-EDITOR_READY-8.png",
      blob: "b9221a328cc2e89578545dcc6f98225be275e903",
      sha256: "9c81273b249810f96491049181e93c0f0d8bc6bf023406398cc6b964342309dc",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-NORMAL-DETAILS_SAVED-15.png",
      blob: "5829c9c1f071f70a7a2dbc8abe5c4e501cd079b2",
      sha256: "d74fe818a8aadb05cd454c7da2bb7f92cec3509e19cad5f938edd9e106ac4d73",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-NORMAL-LIBRARY_RETURNED-18.png",
      blob: "52cbcbf24b10c5228dd0b4db7cd02cc45668af34",
      sha256: "cffaec150debcadd3f200676cf107b19f741cdb0c943dcc1df77a021c4aa5670",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-NORMAL-RETURNED-20.png",
      blob: "ff54691137ee6a6d40bca5fa9da8fc2c2e0b7974",
      sha256: "672de360a1a45ecdf3b2f44545d56ccedb4bfc930fae9ad4f4cf1696720bfe7c",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-NORMAL.trace.zip",
      blob: "e86b9c3eb69a13bb34d26f44a048a4d45cc519b4",
      sha256: "745cb8215e7aee372adb5d7049bd876870cc134e125024d6805b2c7cbe841ab4",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/f2dbb3ebf2e8293f302b36f512ed3bbd.webm",
      blob: "8af6f0c390d35a72ad4dd2c901c260f0d26e315a",
      sha256: "fa4509077fd3e6d31b0e65e34667fdfbc328745fbb81e7ec25db791fa18088a0",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-REDUCED-CHOICES_READY-1.png",
      blob: "958cf553eebea4d087d56888e570c3b22e09cbb4",
      sha256: "240f0a49e65cfc83b61ca0de00833a36be6dce49d7796ecfd97fd4e282a2b9ee",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-REDUCED-CHOICES_READY-2.png",
      blob: "958cf553eebea4d087d56888e570c3b22e09cbb4",
      sha256: "240f0a49e65cfc83b61ca0de00833a36be6dce49d7796ecfd97fd4e282a2b9ee",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-REDUCED-RETURNED-4.png",
      blob: "6133fcda1aad078e766524d3601ca62297f9e10d",
      sha256: "0bb36c53da60a7077b62a3c239d38b925a6ba12d55acfde724979edf948e62e5",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-REDUCED-CHOICES_READY-6.png",
      blob: "a74d283751c5f419fa0495056e52b52d7e22ee1a",
      sha256: "82e4bdfe042932f38a5e2d2be3fa5feda6247be171d6b997539bd14a219e0a37",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-REDUCED-EDITOR_READY-8.png",
      blob: "8495f70613dc434ee3f46c1bf52ce85e345bd033",
      sha256: "1c3cacb9127477309ac14933c14aeec16021ccb999be5e2b628064e82fd39f69",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-REDUCED-DETAILS_SAVED-15.png",
      blob: "00c270b333fbd25212c3ad34712b5888f5d63fd5",
      sha256: "aa62d376cd57911475babea14b7fae7636e185feeea73873eac5aeb17be2055d",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-REDUCED-LIBRARY_RETURNED-18.png",
      blob: "deca5112494a41ef570817e280ada99017302689",
      sha256: "b991c6fc8cc83a92dc2b0ac10cbf722c15d755a8c17f20117dc813b7adeca9d9",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-REDUCED-RETURNED-20.png",
      blob: "3b18e2949b5ceb48cfd0826f483de959b33e21c8",
      sha256: "9dacd86130564eb4028e53c1b8bd1d116c9e41de6778fa2e2862de5b3341abb2",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-creation-and-inline-details-MOBILE-CREATOR-REDUCED.trace.zip",
      blob: "f6d5ed23e96870022be259fea6166217ce48a55a",
      sha256: "45300ccc54b1f6a0f0c356c284e6f7d0c7d43b0abb50035217a769ae91725d5d",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/52efd6b39508899cc3360dab1e5c141f.webm",
      blob: "7c4c41ccdb41c3f81357250bf0a838c1dcc0b6b0",
      sha256: "dbf4cc51c9a307f693629d3cbd2e9e7eaef8ccc999b3fed24807f2bd7f3b68f1",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/candidate-review.json",
      blob: "e003b2e3438a9b3ca594ee5e88156b5aa9395cb2",
      sha256: "f660cec83bb85c6a07b2ae2e4b785faf7f304016515a5afb42cba0263a38d86f",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/chronicle.creation-review-packet.json",
      blob: "1978908145e00a1f0f463074e62d06d14a7c594e",
      sha256: "add8df0b6d7d01afbdd252527afd536d988bd90c49788d000464778f50acc38e",
    },
  ],
  stableWitnesses: [
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/independent-review-blocked-iteration3.json",
      blob: "b917fa116ba34b9d72f4cd493fd82413e2ec1e7d",
      sha256: "e41be266cc680e25a016ef752b22aa13fdababe1ea9a852988e63ce997312521",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/sc-00a-review4-exception-20261015/exception.proposed.json",
      blob: "08df1ba26f733d1201c13fcaa09fe62615dd6590",
      sha256: "ea869f254a0b4f4eac0be2f2e3e2b3c8ee8a7c9274e21b9e5677403cebe6480e",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/proposed-landmark-labels.patch",
      blob: "47782e687bd2d70b0106eaf2240fd20d6bdb60d0",
      sha256: "d92ff80369604adec514ec9a1bac4393b9a3a2a80d01d42cc78529b190c57e76",
    },
    {
      path: "Development_Docs/Projects/Chronicle_Creator/evidence/sc-00a-review4-exception-20261015/owner-approval.json",
      blob: "600ffddbb8e02cdd2e618abdecf668fc9c6db466",
      sha256: "eca1e5726690828c25c72ad7244a27a29d7ff18f21d25304c8d9777cb8098705",
    },
  ],
  preservationManifest: {
    path: "Development_Docs/Projects/Chronicle_Creator/evidence/review3-original-38688383108/preservation-manifest.json",
    blob: "f4fe8867cd6e44150eb33e162257d1aa76d0ac12",
    sha256: "b5d5740f929256b0b5046a2792717dc3feec37e5db0ab0b165d0a669fd24dc11",
  },
  historicalReview2: {
    sourceRevision: "495fb5a760cc1edee7918c259b7943f6ecb22427",
    sourcePath: "Development_Docs/Testing/Product_Experience/candidate-review.json",
    blob: "f25d4d883324200593b4dcc532a88e83dc4e0934",
    sha256: "0821d665691dad70825e3562b47292d0f643327566a7e576bf3753e435ed9168",
  },
  predecessorRegistry: {
    count: 26,
    digest: "cb613349b1b8c613a3548d2871d620e19fcf31656f6f3ddc6d1eed0a099b2d38",
  },
});
