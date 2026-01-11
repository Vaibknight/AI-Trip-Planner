const Trip = require('../models/Trip');
const logger = require('../utils/logger');

class TripService {
  /**
   * Create a new trip
   */
  async createTrip(userId, tripData) {
    try {
      // Ensure all destinations have required fields
      if (tripData.destinations && Array.isArray(tripData.destinations)) {
        tripData.destinations = tripData.destinations.map(dest => ({
          ...dest,
          name: dest.name || dest.city || '',
          city: dest.city || '',
          country: dest.country || ''
        }));
      }

      const trip = new Trip({
        ...tripData,
        userId
      });

      await trip.save();
      logger.info(`Trip created: ${trip._id} by user: ${userId}`);
      return trip;
    } catch (error) {
      logger.error('Error creating trip:', error);
      throw error;
    }
  }

  /**
   * Get trip by ID
   */
  async getTripById(tripId, userId) {
    try {
      const trip = await Trip.findOne({ _id: tripId, userId });
      if (!trip) {
        throw new Error('Trip not found');
      }
      return trip;
    } catch (error) {
      logger.error('Error getting trip:', error);
      throw error;
    }
  }

  /**
   * Get all trips for a user
   */
  async getUserTrips(userId, filters = {}) {
    try {
      const query = { userId };

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.startDate || filters.endDate) {
        query.startDate = {};
        if (filters.startDate) {
          query.startDate.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.startDate.$lte = new Date(filters.endDate);
        }
      }

      const trips = await Trip.find(query)
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.skip || 0);

      const total = await Trip.countDocuments(query);

      return {
        trips,
        total,
        page: Math.floor((filters.skip || 0) / (filters.limit || 50)) + 1,
        pages: Math.ceil(total / (filters.limit || 50))
      };
    } catch (error) {
      logger.error('Error getting user trips:', error);
      throw error;
    }
  }

  /**
   * Update trip
   */
  async updateTrip(tripId, userId, updateData) {
    try {
      const trip = await Trip.findOneAndUpdate(
        { _id: tripId, userId },
        { $set: { ...updateData, updatedAt: new Date() } },
        { new: true, runValidators: true }
      );

      if (!trip) {
        throw new Error('Trip not found');
      }

      logger.info(`Trip updated: ${tripId} by user: ${userId}`);
      return trip;
    } catch (error) {
      logger.error('Error updating trip:', error);
      throw error;
    }
  }

  /**
   * Delete trip
   */
  async deleteTrip(tripId, userId) {
    try {
      const trip = await Trip.findOneAndDelete({ _id: tripId, userId });
      
      if (!trip) {
        throw new Error('Trip not found');
      }

      logger.info(`Trip deleted: ${tripId} by user: ${userId}`);
      return trip;
    } catch (error) {
      logger.error('Error deleting trip:', error);
      throw error;
    }
  }

  /**
   * Add activity to itinerary day
   */
  async addActivity(tripId, userId, dayIndex, activity) {
    try {
      const trip = await this.getTripById(tripId, userId);
      
      if (!trip.itinerary[dayIndex]) {
        throw new Error('Day not found in itinerary');
      }

      trip.itinerary[dayIndex].activities.push(activity);
      await trip.save();

      return trip;
    } catch (error) {
      logger.error('Error adding activity:', error);
      throw error;
    }
  }

  /**
   * Update activity in itinerary
   */
  async updateActivity(tripId, userId, dayIndex, activityIndex, activityData) {
    try {
      const trip = await this.getTripById(tripId, userId);
      
      if (!trip.itinerary[dayIndex] || !trip.itinerary[dayIndex].activities[activityIndex]) {
        throw new Error('Activity not found');
      }

      trip.itinerary[dayIndex].activities[activityIndex] = {
        ...trip.itinerary[dayIndex].activities[activityIndex],
        ...activityData
      };

      await trip.save();
      return trip;
    } catch (error) {
      logger.error('Error updating activity:', error);
      throw error;
    }
  }

  /**
   * Delete activity from itinerary
   */
  async deleteActivity(tripId, userId, dayIndex, activityIndex) {
    try {
      const trip = await this.getTripById(tripId, userId);
      
      if (!trip.itinerary[dayIndex] || !trip.itinerary[dayIndex].activities[activityIndex]) {
        throw new Error('Activity not found');
      }

      trip.itinerary[dayIndex].activities.splice(activityIndex, 1);
      await trip.save();

      return trip;
    } catch (error) {
      logger.error('Error deleting activity:', error);
      throw error;
    }
  }
}

module.exports = new TripService();

