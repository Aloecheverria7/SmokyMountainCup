-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1:3306
-- Tiempo de generación: 15-10-2026 a las 19:17:13
-- Versión del servidor: 11.8.9-MariaDB-log
-- Versión de PHP: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `u460493799_smoky`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `categories`
--

INSERT INTO `categories` (`id`, `name`) VALUES
(1, 'Categoria A'),
(2, 'Categoria B'),
(3, 'Femenil'),
(4, 'Juvenil');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `games`
--

CREATE TABLE `games` (
  `id` int(11) NOT NULL,
  `home_team_id` int(11) DEFAULT NULL,
  `guest_team_id` int(11) DEFAULT NULL,
  `home_score` int(11) DEFAULT 0,
  `guest_score` int(11) DEFAULT 0,
  `status` varchar(20) DEFAULT 'not started',
  `current_minute` int(11) DEFAULT 0,
  `last_update` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `field` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `games`
--

INSERT INTO `games` (`id`, `home_team_id`, `guest_team_id`, `home_score`, `guest_score`, `status`, `current_minute`, `last_update`, `field`) VALUES
(1, 25, 26, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2A'),
(2, 27, 28, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2B'),
(3, 25, 27, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2A'),
(4, 26, 28, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2B'),
(5, 25, 28, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2A'),
(6, 26, 27, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2B'),
(7, 29, 30, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2A'),
(8, 31, 32, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2B'),
(9, 29, 31, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2A'),
(10, 30, 32, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2B'),
(11, 29, 32, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2A'),
(12, 30, 31, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2B'),
(13, 33, 34, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2A'),
(14, 35, 36, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2B'),
(15, 33, 35, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2A'),
(16, 34, 36, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2B'),
(17, 33, 36, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2A'),
(18, 34, 35, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2B'),
(19, 37, 38, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2A'),
(20, 39, 40, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2B'),
(21, 37, 39, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2A'),
(22, 38, 40, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2B'),
(23, 37, 40, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2A'),
(24, 38, 39, 0, 0, 'not started', 0, '2024-07-27 09:58:31', 'C-2B');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `goals`
--

CREATE TABLE `goals` (
  `id` int(11) NOT NULL,
  `game_id` int(11) DEFAULT NULL,
  `team_id` int(11) DEFAULT NULL,
  `type` enum('goal','own_goal') NOT NULL,
  `minute` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `groups`
--

CREATE TABLE `groups` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `category_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `groups`
--

INSERT INTO `groups` (`id`, `name`, `category_id`) VALUES
(1, 'Grupo A', 1),
(2, 'Grupo B', 1),
(3, 'Grupo A', 2),
(4, 'Grupo B', 2),
(5, 'Grupo A', 3),
(6, 'Grupo B', 3),
(7, '6-9 años', 4),
(8, '10-11 años', 4),
(9, '12-13 años', 4),
(10, '14-17 años', 4);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `group_teams`
--

CREATE TABLE `group_teams` (
  `id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL,
  `team_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `group_teams`
--

INSERT INTO `group_teams` (`id`, `group_id`, `team_id`) VALUES
(1, 1, 1),
(2, 1, 2),
(3, 1, 3),
(4, 1, 4),
(5, 2, 5),
(6, 2, 6),
(7, 2, 7),
(8, 2, 8),
(9, 3, 9),
(10, 3, 10),
(11, 3, 11),
(12, 3, 12),
(13, 4, 13),
(14, 4, 14),
(15, 4, 15),
(16, 4, 16),
(17, 5, 17),
(18, 5, 18),
(19, 5, 19),
(20, 5, 20),
(21, 6, 21),
(22, 6, 22),
(23, 6, 23),
(24, 6, 24),
(25, 7, 25),
(26, 7, 26),
(27, 7, 27),
(28, 7, 28),
(29, 8, 29),
(30, 8, 30),
(31, 8, 31),
(32, 8, 32),
(33, 9, 33),
(34, 9, 34),
(35, 9, 35),
(36, 9, 36),
(37, 10, 37),
(38, 10, 38),
(39, 10, 39),
(40, 10, 40);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `teams`
--

CREATE TABLE `teams` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `teams`
--

INSERT INTO `teams` (`id`, `name`) VALUES
(1, 'Gainesville'),
(2, 'Achoapa'),
(3, '11 Gargolas'),
(4, 'DEP Forex'),
(5, 'Olimpia'),
(6, 'Galacticos'),
(7, 'Catrachos FC'),
(8, 'Roma FC'),
(9, 'Junior FC'),
(10, 'Tango FC'),
(11, 'Mecanicos'),
(12, 'Alcoholicos'),
(13, 'AC Milan'),
(14, 'Olimpia FC'),
(15, 'Los Lobos'),
(16, 'Chelsea'),
(17, 'Knoxville'),
(18, 'Tottenham'),
(19, 'Atlas'),
(20, 'BR Elitte'),
(21, 'Vista Hermosa'),
(22, 'Ball Busters'),
(23, 'Bayer Munich'),
(24, 'Valle FC'),
(25, 'Real España'),
(26, 'Carolina'),
(27, 'All Star'),
(28, 'Inter Miami'),
(29, 'Galacticos'),
(30, 'Panthers FC'),
(31, 'Muñecos de Papel'),
(32, 'Serville Start'),
(33, 'Nedo Soccer'),
(34, 'Gainsville Fire'),
(35, 'Sevier Start'),
(36, 'Galacticos'),
(37, 'Juniors'),
(38, 'Potros Olancho'),
(39, 'Flamingo'),
(40, 'Panthers');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `team_stats`
--

CREATE TABLE `team_stats` (
  `team_id` int(11) NOT NULL,
  `games_played` int(11) DEFAULT 0,
  `wins` int(11) DEFAULT 0,
  `draws` int(11) DEFAULT 0,
  `losses` int(11) DEFAULT 0,
  `goals_scored` int(11) DEFAULT 0,
  `goals_conceded` int(11) DEFAULT 0,
  `goal_difference` int(11) DEFAULT 0,
  `points` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `team_stats`
--

INSERT INTO `team_stats` (`team_id`, `games_played`, `wins`, `draws`, `losses`, `goals_scored`, `goals_conceded`, `goal_difference`, `points`) VALUES
(1, 3, 1, 1, 1, 8, 3, 0, 4),
(2, 4, 3, 0, 0, 3, 0, 3, 9),
(3, 3, 1, 2, 0, 6, 2, 12, 5),
(4, 3, 0, 0, 3, 2, 14, -12, 0),
(5, 2, 0, 0, 2, 2, 5, -2, 0),
(6, 2, 2, 0, 0, 4, 0, 0, 6),
(7, 2, 2, 0, 0, 5, 2, 0, 6),
(8, 2, 0, 0, 2, 0, 4, 0, 0),
(9, 3, 0, 1, 2, 3, 7, 0, 1),
(10, 3, 3, 0, 0, 13, 4, 3, 9),
(11, 3, 0, 1, 2, 3, 7, -2, 1),
(12, 3, 2, 0, 1, 5, 6, 2, 6),
(13, 3, 3, 0, 0, 7, 0, 2, 9),
(14, 3, 0, 1, 2, 0, 4, 0, 1),
(15, 3, 2, 0, 1, 4, 3, 2, 6),
(16, 3, 0, 1, 2, 0, 4, -2, 1),
(17, 2, 1, 0, 1, 2, 2, 2, 3),
(18, 2, 2, 0, 0, 4, 1, 0, 6),
(19, 2, 0, 0, 2, 0, 4, -2, 0),
(20, 1, 1, 0, 0, 2, 0, 2, 3),
(21, 1, 1, 0, 0, 3, 2, 0, 3),
(22, 1, 0, 0, 1, 2, 3, -1, 0),
(23, 0, 0, 0, 0, 0, 0, 0, 0),
(24, 1, 0, 0, 1, 0, 2, -2, 0),
(25, 0, 0, 0, 0, 0, 0, 0, 0),
(26, 0, 0, 0, 0, 0, 0, 0, 0),
(27, 0, 0, 0, 0, 0, 0, 0, 0),
(28, 0, 0, 0, 0, 0, 0, 0, 0),
(29, 2, 2, 0, 0, 4, 0, 0, 6),
(30, 0, 0, 0, 0, 0, 0, 0, 0),
(31, 0, 0, 0, 0, 0, 0, 0, 0),
(32, 0, 0, 0, 0, 0, 0, 0, 0),
(33, 0, 0, 0, 0, 0, 0, 0, 0),
(34, 0, 0, 0, 0, 0, 0, 0, 0),
(35, 0, 0, 0, 0, 0, 0, 0, 0),
(36, 2, 2, 0, 0, 4, 0, 0, 6),
(37, 0, 0, 0, 0, 0, 0, 0, 0),
(38, 0, 0, 0, 0, 0, 0, 0, 0),
(39, 0, 0, 0, 0, 0, 0, 0, 0),
(40, 0, 0, 0, 0, 0, 0, 0, 0);

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `games`
--
ALTER TABLE `games`
  ADD PRIMARY KEY (`id`),
  ADD KEY `home_team_id` (`home_team_id`),
  ADD KEY `guest_team_id` (`guest_team_id`);

--
-- Indices de la tabla `goals`
--
ALTER TABLE `goals`
  ADD PRIMARY KEY (`id`),
  ADD KEY `game_id` (`game_id`),
  ADD KEY `team_id` (`team_id`);

--
-- Indices de la tabla `groups`
--
ALTER TABLE `groups`
  ADD PRIMARY KEY (`id`),
  ADD KEY `category_id` (`category_id`);

--
-- Indices de la tabla `group_teams`
--
ALTER TABLE `group_teams`
  ADD PRIMARY KEY (`id`),
  ADD KEY `group_id` (`group_id`),
  ADD KEY `team_id` (`team_id`);

--
-- Indices de la tabla `teams`
--
ALTER TABLE `teams`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `team_stats`
--
ALTER TABLE `team_stats`
  ADD PRIMARY KEY (`team_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `games`
--
ALTER TABLE `games`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT de la tabla `goals`
--
ALTER TABLE `goals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `groups`
--
ALTER TABLE `groups`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT de la tabla `group_teams`
--
ALTER TABLE `group_teams`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=41;

--
-- AUTO_INCREMENT de la tabla `teams`
--
ALTER TABLE `teams`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=41;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `games`
--
ALTER TABLE `games`
  ADD CONSTRAINT `games_ibfk_1` FOREIGN KEY (`home_team_id`) REFERENCES `teams` (`id`),
  ADD CONSTRAINT `games_ibfk_2` FOREIGN KEY (`guest_team_id`) REFERENCES `teams` (`id`);

--
-- Filtros para la tabla `goals`
--
ALTER TABLE `goals`
  ADD CONSTRAINT `goals_ibfk_1` FOREIGN KEY (`game_id`) REFERENCES `games` (`id`),
  ADD CONSTRAINT `goals_ibfk_2` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`);

--
-- Filtros para la tabla `groups`
--
ALTER TABLE `groups`
  ADD CONSTRAINT `groups_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`);

--
-- Filtros para la tabla `group_teams`
--
ALTER TABLE `group_teams`
  ADD CONSTRAINT `group_teams_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  ADD CONSTRAINT `group_teams_ibfk_2` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
