# -*- coding: utf-8 -*-
"""
Created on Sun Jun  4 19:12:52 2017

@author: GonzaloW7
"""

import sqlite3
from sqlite3 import Error
import datetime
import matplotlib.pyplot as plt
import seaborn as sns

def create_connection(db_file):
	""" create a database connection to the SQLite database
		specified by the db_file
	:param db_file: database file
	:return: Connection object or None
	"""
	try:
		conn = sqlite3.connect(db_file)
		return conn
	except Error as e:
		print(e)

	return None


def get_prices_for_station(conn, station_id):
	cur = conn.cursor()
	cur.execute("""SELECT date, diesel_price
					FROM gas_data
					WHERE ideess={0}""".format(station_id))

	rows = cur.fetchall()
	return list(map(lambda x: [x[0],date_to_str(x[0]) , x[1]], rows))

def date_to_str(unix):
	return datetime.datetime.fromtimestamp(int(unix)).strftime('%Y/%m/%d')

def draw_graph(rows):
	plt.plot([r[2] for r in rows], [r[2] for r in rows], color='red', label='prices €')

def main():
	database = "gas_prices.db"
	# create a database connection
	conn = create_connection(database)
	with conn:
		rows = get_prices_for_station(conn, 8456)
	draw_graph(rows)


if __name__ == '__main__':
	main()