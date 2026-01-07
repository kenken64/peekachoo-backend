const express = require("express");
const pokemonController = require("../controllers/pokemonController");
const { authMiddleware } = require("../middlewares/authMiddleware");

const router = express.Router();

// All Pokemon routes are protected
router.use(authMiddleware);

// Sync Pokemon from PokeAPI GraphQL to database
router.post("/sync", pokemonController.syncPokemon);

// Get a random unrevealed Pokemon for endless mode
router.get("/random-unrevealed", pokemonController.getRandomUnrevealed);

// Get all Pokemon from database
router.get("/", pokemonController.getAllPokemon);

// Search Pokemon by name
router.get("/search", pokemonController.searchPokemon);

// Get Pokemon by type
router.get("/type/:type", pokemonController.getPokemonByType);

// Get Pokemon by ID
router.get("/:id", pokemonController.getPokemonById);

module.exports = router;
