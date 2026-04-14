# NutriTrack: Performance-First Nutrition App

A minimalist, high-performance application for tracking caloric intake, macronutrient distribution, and meal timing. Designed for users who want granular control over their data without the bloat of mainstream fitness apps.

## Core Features

* **Macro-Specific Logging:** Dedicated tracking for proteins, fats, and carbohydrates.
* **Meal Templates:** Create and save high-protein meal configurations for one-tap logging.
* **Workout Integration:** Toggle caloric targets based on training intensity and volume.
* **SQL Persistence:** Relational database structure for historical data analysis and trend tracking.
* **Performance Focus:** Optimized queries for fast retrieval of weekly and monthly aggregates.

## Tech Stack

* **Frontend:** React / React Native (Cross-platform)
* **Backend:** Node.js / Express
* **Database:** SQL Server (Managing complex relations between users, meals, and macronutrients)
* **API:** RESTful architecture

## Getting Started

### Prerequisites

* Node.js (v18.x or higher)
* SQL Server Management Studio
* NPM or Yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/username/nutritrack.git
    cd nutritrack
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Configuration:**
    Create a `.env` file in the root directory:
    ```env
    DB_SERVER=localhost
    DB_NAME=NutriTrackDB
    DB_USER=your_user
    DB_PASSWORD=your_password
    JWT_SECRET=your_secret_key
    ```

4.  **Database Setup:**
    Run the initialization scripts found in `/database/schema.sql` to set up tables, relationships, and triggers.

5.  **Run the App:**
    ```bash
    npm run dev
    ```

## Project Structure

* `/src/api`: Route handlers and business logic.
* `/src/db`: Stored procedures and raw SQL queries for reporting.
* `/src/components`: Reusable UI components.
* `/src/utils`: Nutrition calculators and data formatters.

## Planned Updates

* [ ] Barcode scanning for instant nutritional lookup.
* [ ] Automated "Protein Goal" notifications.
* [ ] Export data to CSV for external analysis.

## Contributing

Contributions are welcome. Please open an issue to discuss proposed changes before submitting a pull request.

---
*Built for tracking metrics that matter.*
