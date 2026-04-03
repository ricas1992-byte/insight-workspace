CREATE TABLE `connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceInsightId` int NOT NULL,
	`targetInsightId` int NOT NULL,
	`label` varchar(300),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `insightHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`insightId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text,
	`status` varchar(20) NOT NULL,
	`category` varchar(200),
	`tagsSnapshot` json,
	`changeNote` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `insightHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `insightTags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`insightId` int NOT NULL,
	`tagId` int NOT NULL,
	CONSTRAINT `insightTags_id` PRIMARY KEY(`id`),
	CONSTRAINT `insightTag_unique` UNIQUE(`insightId`,`tagId`)
);
--> statement-breakpoint
CREATE TABLE `insights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text,
	`status` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
	`category` varchar(200),
	`positionX` int,
	`positionY` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `insights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(7) DEFAULT '#6366f1',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tags_id` PRIMARY KEY(`id`)
);
